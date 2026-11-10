import { Logger } from "@nestjs/common";
import { eq, inArray, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { TodoSeriesOwnerDormancyAdapter } from "#api/modules/notification/reminders/infrastructure/adapters/todo-series-owner-dormancy.adapter";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { CatchUpTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/catch-up-todo-series.use-case";
import { MaterializeDueTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-due-todo-series.use-case";
import { MaterializeTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-occurrences.use-case";
import { MaterializeTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-series.use-case";
import { PublishTodoCreationUseCase } from "#api/modules/planning/todo-series/application/use-cases/publish-todo-creation.use-case";
import { RepeatRule } from "#api/modules/planning/todo-series/domain/repeat-rule.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { TodoSeriesOwnerAdapter } from "#api/modules/planning/todo-series/infrastructure/adapters/todo-series-owner.adapter";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DateClock } from "#test/doubles/platform/date-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { StubCurrentUserAccess } from "#test/fixtures/auth-credential.fixture";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const TODAY = "2026-11-05";
const RETURNED_AT = new Date(`${TODAY}T03:00:00.000Z`);
const LAST_MOVED_AT = new Date("2026-05-01T00:00:00.000Z");
const STALE_CURSOR = "2026-07-30";
const HORIZON_ROWS = 91;

// 휴면 판정은 등급만 읽는다. 나머지 권한 조회가 불리면 테스트가 잘못 짠 것이다
class StubTierEntitlementReader extends StubCurrentUserAccess implements EntitlementReaderPort {
  async can(): Promise<boolean> {
    throw new Error("휴면 판정은 can을 부르지 않는다");
  }

  async canInTx(): Promise<boolean> {
    throw new Error("휴면 판정은 canInTx를 부르지 않는다");
  }

  async getLimit(): Promise<number | null> {
    throw new Error("휴면 판정은 getLimit을 부르지 않는다");
  }

  async getLimitInTx(): Promise<number | null> {
    throw new Error("휴면 판정은 getLimitInTx를 부르지 않는다");
  }

  async readFeatureQuotaInTx(): ReturnType<EntitlementReaderPort["readFeatureQuotaInTx"]> {
    throw new Error("휴면 판정은 readFeatureQuotaInTx를 부르지 않는다");
  }
}

describe("반복 할 일 휴면·복귀 (실제 PostgreSQL)", () => {
  const statements: string[] = [];
  const database = new TestDatabase({
    createClient: (url) =>
      createTestClient(url, { max: 8 }, (statement) => {
        statements.push(statement);
      }),
  });
  let client: TestDatabaseClient;
  let fixture: ReturnType<typeof createDatabaseTransactionFixture>;
  let jobQueue: InMemoryJobQueue;
  let userId: string;
  const premiumUserIds = new Set<string>();
  let categoryId: number;

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    premiumUserIds.clear();
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(RETURNED_AT);
    fixture = createDatabaseTransactionFixture(client);
    jobQueue = new InMemoryJobQueue();
    const seeded = await seedUser("dormant@example.com", "DORMANT1", {
      lastActiveAt: RETURNED_AT,
    });
    userId = seeded.userId;
    categoryId = seeded.categoryId;
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(async () => {
    await database.stop();
  });

  async function seedUser(
    email: string,
    userTag: string,
    activity: { lastActiveAt: Date | null; createdAt?: Date; timezone?: string },
  ) {
    const user = UserFixture.create({
      id: createEntityId(),
      email,
      userTag,
      status: "ACTIVE",
      lastActiveAt: activity.lastActiveAt,
      createdAt: activity.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    });
    await client.insert(userTable).values(user);
    if (activity.timezone != null) {
      await client.insert(userPreference).values({ userId: user.id, timezone: activity.timezone });
    }
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: user.id, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    return { userId: user.id, categoryId: category.id };
  }

  function dueRunner() {
    const todoRepository = new DrizzleTodoRepository(fixture.txHost);
    return new MaterializeTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: new DrizzleTodoSeriesRepository(fixture.txHost),
      materializer: new MaterializeTodoOccurrencesUseCase({
        todoRepository,
        todoReminder: new TodoReminderSchedulerAdapter(jobQueue, new DateClock()),
        applyTodoEvents: { execute: async () => undefined },
      }),
      effects: new PublishTodoCreationUseCase({
        todoCache: {
          invalidateTodoCategories: async () => undefined,
          invalidateFriendTodos: async () => undefined,
        },
        logger: new Logger("DormancyIntegration"),
      }),
      unitOfWork: fixture.uow,
      mutationLock: new PostgresMutationLockAdapter(fixture.txHost),
    });
  }

  function entitlements() {
    const reader = new StubTierEntitlementReader();
    for (const id of premiumUserIds) {
      reader.tiers.set(id, "PREMIUM");
    }
    return reader;
  }

  function seriesOwner() {
    return new TodoSeriesOwnerAdapter(new DrizzleUserRepository(fixture.txHost), entitlements());
  }

  /** 서버 프로세스 하나. 메모리 캐시는 프로세스마다 따로다. */
  function catchUp() {
    return new CatchUpTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: new DrizzleTodoSeriesRepository(fixture.txHost),
      seriesOwner: seriesOwner(),
      dueRunner: dueRunner(),
      logger: new Logger("DormancyIntegration"),
    });
  }

  function job() {
    return new MaterializeDueTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: new DrizzleTodoSeriesRepository(fixture.txHost),
      seriesOwner: seriesOwner(),
      dueRunner: dueRunner(),
      alert: new RecordingOperationalAlert(),
      logger: new Logger("DormancyIntegration"),
    });
  }

  async function seedStaleSeries(
    overrides: {
      id?: string;
      owner?: { userId: string; categoryId: number };
      rule?: RepeatRule;
      startDate?: string;
      nextOccurrenceDate?: string;
      timezone?: string;
      scheduledLocalTime?: string | null;
    } = {},
  ) {
    const id = overrides.id ?? createEntityId();
    const series = TodoSeries.create({
      id: TodoSeriesId.reconstitute(id),
      userId: UserId.reconstitute(overrides.owner?.userId ?? userId),
      categoryId: overrides.owner?.categoryId ?? categoryId,
      title: TodoTitle.create("매일 반복"),
      visibility: "PUBLIC",
      scheduledLocalTime: overrides.scheduledLocalTime ?? null,
      timezone: overrides.timezone ?? "UTC",
      rule: overrides.rule ?? RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      startDate: overrides.startDate ?? "2026-03-01",
      checklistTemplate: [{ title: "항목" }],
      now: Temporal.Instant.fromEpochMilliseconds(LAST_MOVED_AT.getTime()),
    });
    await new DrizzleTodoSeriesRepository(fixture.txHost).insert(series);
    await client
      .update(todoSeries)
      .set({
        nextOccurrenceDate: new Date(overrides.nextOccurrenceDate ?? STALE_CURSOR),
        updatedAt: LAST_MOVED_AT,
      })
      .where(eq(todoSeries.id, id));
    return id;
  }

  async function occurrenceDates(seriesId: string) {
    const rows = await client
      .select({ date: todo.occurrenceDate })
      .from(todo)
      .where(eq(todo.seriesId, seriesId))
      .orderBy(todo.occurrenceDate);
    return rows.map((row) => row.date?.toISOString().slice(0, 10));
  }

  async function cursorOf(seriesId: string) {
    const row = await client.query.todoSeries.findFirst({ where: { id: seriesId } });
    return row?.nextOccurrenceDate?.toISOString().slice(0, 10) ?? null;
  }

  describe("밤 작업의 휴면", () => {
    it.each([
      { name: "정확히 60일째면 채운다", lastActiveAt: "2026-09-06T03:00:00.000Z", dormant: false },
      { name: "61일째면 건너뛴다", lastActiveAt: "2026-09-05T03:00:00.000Z", dormant: true },
    ])("$name", async ({ lastActiveAt, dormant }) => {
      // Given
      const owner = await seedUser("edge@example.com", "DORMANT2", {
        lastActiveAt: new Date(lastActiveAt),
        timezone: "UTC",
      });
      const id = await seedStaleSeries({ owner, nextOccurrenceDate: "2027-01-01" });
      // When
      const result = await job().execute();
      // Then
      expect(result.dormantCount).toBe(dormant ? 1 : 0);
      expect(await cursorOf(id)).toBe(dormant ? "2027-01-01" : "2027-02-04");
      expect(await occurrenceDates(id)).toHaveLength(dormant ? 0 : 34);
    });

    it("활동 기록이 없으면 가입일로 잰다", async () => {
      // Given
      const fresh = await seedUser("fresh@example.com", "DORMANT3", {
        lastActiveAt: null,
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      });
      const old = await seedUser("old@example.com", "DORMANT4", {
        lastActiveAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const freshId = await seedStaleSeries({ owner: fresh, nextOccurrenceDate: "2027-01-01" });
      const oldId = await seedStaleSeries({ owner: old, nextOccurrenceDate: "2027-01-01" });
      // When
      await job().execute();
      // Then
      expect(await cursorOf(freshId)).toBe("2027-02-04");
      expect(await cursorOf(oldId)).toBe("2027-01-01");
    });

    it("저장된 사용자 시간대의 달력으로 잰다", async () => {
      // Given
      vi.setSystemTime(new Date("2026-11-05T15:00:00.000Z"));
      const lastActiveAt = new Date("2026-09-06T12:00:00.000Z");
      const seoul = await seedUser("seoul@example.com", "DORMANT5", {
        lastActiveAt,
        timezone: "Asia/Seoul",
      });
      const losAngeles = await seedUser("la@example.com", "DORMANT6", {
        lastActiveAt,
        timezone: "America/Los_Angeles",
      });
      const seoulId = await seedStaleSeries({ owner: seoul, nextOccurrenceDate: "2027-01-01" });
      const losAngelesId = await seedStaleSeries({
        owner: losAngeles,
        nextOccurrenceDate: "2027-01-01",
      });
      // When
      await job().execute();
      // Then
      expect(await cursorOf(seoulId)).toBe("2027-01-01");
      expect(await cursorOf(losAngelesId)).not.toBe("2027-01-01");
    });

    it("돌아왔지만 목록을 열지 않은 사용자는 작업이 오늘부터 채운다", async () => {
      // Given
      const id = await seedStaleSeries();
      // When
      const result = await job().execute();
      // Then
      const dates = await occurrenceDates(id);
      expect(result.createdCount).toBe(HORIZON_ROWS);
      expect(dates.at(0)).toBe(TODAY);
    });
  });

  describe("복귀", () => {
    it("오늘부터 90일을 채우고 지난 날은 만들지 않으며 체크리스트를 복사한다", async () => {
      // Given
      const id = await seedStaleSeries();
      // When
      await catchUp().execute(userId);
      // Then
      const dates = await occurrenceDates(id);
      expect(dates).toHaveLength(HORIZON_ROWS);
      expect(dates.at(0)).toBe(TODAY);
      expect(dates.at(-1)).toBe("2027-02-03");
      expect(await cursorOf(id)).toBe("2027-02-04");
      const row = await client.query.todo.findFirst({
        where: { seriesId: id },
        with: { items: true },
      });
      expect(row?.items.map((item) => item.title)).toEqual(["항목"]);
    });

    it("90일보다 오래 비워도 같고 활동 기록이 언제든 상관없다", async () => {
      // Given
      const id = await seedStaleSeries({
        startDate: "2024-01-01",
        nextOccurrenceDate: "2024-04-01",
      });
      await client
        .update(todoSeries)
        .set({ updatedAt: new Date("2024-01-01T00:00:00.000Z") })
        .where(eq(todoSeries.id, id));
      // When
      await catchUp().execute(userId);
      // Then
      const dates = await occurrenceDates(id);
      expect(dates.at(0)).toBe(TODAY);
      expect(dates).toHaveLength(HORIZON_ROWS);
    });

    it("규칙 시간대의 오늘로 채운다", async () => {
      // Given
      vi.setSystemTime(new Date("2026-11-05T16:00:00.000Z"));
      const seoulId = await seedStaleSeries({ timezone: "Asia/Seoul" });
      const newYorkId = await seedStaleSeries({ timezone: "America/New_York" });
      // When
      await catchUp().execute(userId);
      // Then
      expect((await occurrenceDates(seoulId)).at(0)).toBe("2026-11-06");
      expect((await occurrenceDates(newYorkId)).at(0)).toBe(TODAY);
    });

    it("커서가 오늘보다 앞서 있으면 이미 오늘 회차가 있으므로 쓰지 않고 작업에 맡긴다", async () => {
      // Given
      const id = await seedStaleSeries({ nextOccurrenceDate: "2026-11-07" });
      // When
      await catchUp().execute(userId);
      // Then
      expect(await cursorOf(id)).toBe("2026-11-07");
      expect(await occurrenceDates(id)).toHaveLength(0);
    });

    it("자리 비운 사이 끝난 규칙은 회차도 새 규칙도 만들지 않고 진행 중에서 빠진다", async () => {
      // Given
      const untilId = await seedStaleSeries({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "UNTIL", date: "2026-10-01" } }),
      });
      const countId = await seedStaleSeries({
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 100 } }),
        nextOccurrenceDate: "2026-05-20",
      });
      const before = await client.$count(todoSeries);
      // When
      await catchUp().execute(userId);
      // Then
      expect(await cursorOf(untilId)).toBeNull();
      expect(await cursorOf(countId)).toBeNull();
      expect(await occurrenceDates(untilId)).toEqual([]);
      expect(await occurrenceDates(countId)).toEqual([]);
      expect(await client.$count(todoSeries)).toBe(before);
    });

    it("30개 규칙이 한 번에 돌아와도 모두 오늘 회차가 있고 중복이 없다", async () => {
      // Given
      const ids: string[] = [];
      for (let index = 0; index < 30; index += 1) {
        ids.push(await seedStaleSeries({ scheduledLocalTime: "23:00" }));
      }
      // When
      await catchUp().execute(userId);
      // Then
      const counts = await client
        .select({
          seriesId: todo.seriesId,
          total: sql<number>`count(*)::int`,
          distinctDates: sql<number>`count(distinct ${todo.occurrenceDate})::int`,
          sortOrders: sql<number>`count(distinct ${todo.sortOrder})::int`,
        })
        .from(todo)
        .where(inArray(todo.seriesId, ids))
        .groupBy(todo.seriesId);
      expect(counts).toHaveLength(30);
      expect(counts.every(({ total, distinctDates }) => total === 91 && distinctDates === 91)).toBe(
        true,
      );
      const today = await client.$count(todo, eq(todo.occurrenceDate, new Date(TODAY)));
      expect(today).toBe(30);
    });

    it("두 기기가 동시에 돌아와도 중복이 없고 둘 다 오늘 회차를 본다", async () => {
      // Given
      const ids = [await seedStaleSeries(), await seedStaleSeries(), await seedStaleSeries()];
      let seenByFirst = 0;
      let seenBySecond = 0;
      const countToday = () => client.$count(todo, eq(todo.occurrenceDate, new Date(TODAY)));
      // When
      await Promise.all([
        catchUp()
          .execute(userId)
          .then(async () => {
            seenByFirst = await countToday();
          }),
        catchUp()
          .execute(userId)
          .then(async () => {
            seenBySecond = await countToday();
          }),
      ]);
      // Then
      expect(seenByFirst).toBe(3);
      expect(seenBySecond).toBe(3);
      for (const id of ids) {
        const dates = await occurrenceDates(id);
        expect(dates).toHaveLength(HORIZON_ROWS);
        expect(new Set(dates).size).toBe(HORIZON_ROWS);
      }
    });

    it("밤 작업과 겹쳐도 중복이 없고 오늘 회차가 있다", async () => {
      // Given
      const ids = [await seedStaleSeries(), await seedStaleSeries(), await seedStaleSeries()];
      // When
      await Promise.all([job().execute(), catchUp().execute(userId)]);
      await job().execute();
      // Then
      for (const id of ids) {
        const dates = await occurrenceDates(id);
        expect(dates.at(0)).toBe(TODAY);
        expect(new Set(dates).size).toBe(HORIZON_ROWS);
      }
    });

    it("다른 트랜잭션이 규칙을 잡고 있으면 기다렸다가 오늘 회차를 만든다", async () => {
      // Given
      const id = await seedStaleSeries();
      const held = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = client.transaction(async (tx) => {
        await tx.execute(sql`SELECT "id" FROM "TodoSeries" WHERE "id" = ${id} FOR UPDATE`);
        held.resolve();
        await release.promise;
      });
      await held.promise;
      // When
      const pending = catchUp().execute(userId);
      release.resolve();
      await holder;
      await pending;
      // Then
      expect((await occurrenceDates(id)).at(0)).toBe(TODAY);
    });

    it("지난 시각의 알림은 등록하지 않고 앞으로의 회차만 등록한다", async () => {
      // Given
      vi.setSystemTime(new Date(`${TODAY}T15:00:00.000Z`));
      const id = await seedStaleSeries({ scheduledLocalTime: "09:00" });
      // When
      await catchUp().execute(userId);
      // Then
      const today = await client.query.todo.findFirst({
        where: { seriesId: id, occurrenceDate: { eq: new Date(TODAY) } },
      });
      const keys = jobQueue.jobs.map((job) => job.options.idempotencyKey);
      expect(today).toBeDefined();
      expect(keys.filter((key) => key?.startsWith(`reminder_${today?.id}_`))).toEqual([]);
      expect(keys).toHaveLength((HORIZON_ROWS - 1) * 2);
    });

    it("카테고리가 사라진 규칙은 실패로 남기고 나머지를 채우며 요청은 성공한다", async () => {
      // Given
      const [goneCategory] = await client
        .insert(todoCategory)
        .values(
          omit(TodoCategoryFixture.create({ userId, sortOrder: 1, name: "사라질 카테고리" }), [
            "id",
          ]),
        )
        .returning();
      if (goneCategory == null) {
        throw new Error("카테고리 fixture 누락");
      }
      const goneId = await seedStaleSeries({
        owner: { userId, categoryId: goneCategory.id },
      });
      const aliveId = await seedStaleSeries();
      await client.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL session_replication_role = replica`);
        await tx.delete(todoCategory).where(eq(todoCategory.id, goneCategory.id));
      });
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      // When
      await expect(catchUp().execute(userId)).resolves.toBeUndefined();
      // Then
      expect(await cursorOf(goneId)).toBe(STALE_CURSOR);
      expect(await occurrenceDates(goneId)).toEqual([]);
      expect((await occurrenceDates(aliveId)).at(0)).toBe(TODAY);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "planning.todo-series.catch-up.failed",
          seriesId: goneId,
        }),
      );
    });

    it("복귀가 실패해도 트랜잭션이 되돌아가고 밤 작업이 오늘부터 채운다", async () => {
      // Given
      const id = await seedStaleSeries();
      const broken = new CatchUpTodoSeriesUseCase({
        clock: new DateClock(),
        seriesRepository: new DrizzleTodoSeriesRepository(fixture.txHost),
        seriesOwner: seriesOwner(),
        dueRunner: {
          execute: async () => {
            throw new Error("쓰기 실패");
          },
        },
        logger: new Logger("DormancyIntegration"),
      });
      // When
      await expect(broken.execute(userId)).resolves.toBeUndefined();
      const afterFailure = await cursorOf(id);
      await job().execute();
      // Then
      expect(afterFailure).toBe(STALE_CURSOR);
      const dates = await occurrenceDates(id);
      expect(dates.at(0)).toBe(TODAY);
      expect(dates).toHaveLength(HORIZON_ROWS);
    });
  });

  describe("일반 요청 비용", () => {
    it("규칙이 뒤처지지 않은 사용자는 하루 첫 요청에 조회 1번, 그 뒤로 0번이다", async () => {
      // Given
      await seedStaleSeries({ nextOccurrenceDate: "2027-02-04" });
      const service = catchUp();
      statements.length = 0;
      // When
      await service.execute(userId);
      const first = statements.length;
      await service.execute(userId);
      await service.execute(userId);
      // Then
      expect(first).toBe(1);
      expect(statements).toHaveLength(1);
    });
  });

  describe("리마인더 발송 시점의 휴면", () => {
    function dormancy() {
      return new TodoSeriesOwnerDormancyAdapter(
        new DrizzleUserRepository(fixture.txHost),
        entitlements(),
      );
    }

    it.each([
      { name: "60일째는 휴면이 아니다", lastActiveAt: "2026-09-06T03:00:00.000Z", expected: false },
      { name: "61일째는 휴면이다", lastActiveAt: "2026-09-05T03:00:00.000Z", expected: true },
    ])("$name", async ({ lastActiveAt, expected }) => {
      // Given
      const owner = await seedUser("reminder@example.com", "DORMANT8", {
        lastActiveAt: new Date(lastActiveAt),
        timezone: "UTC",
      });
      // When
      const dormantSince = await dormancy().findDormantSince(owner.userId);
      // Then
      expect(dormantSince).toBe(expected ? lastActiveAt.slice(0, 10) : null);
    });

    it("활동 기록이 없으면 가입일로 재고 설정 행이 없어도 판단한다", async () => {
      // Given
      const owner = await seedUser("no-pref@example.com", "DORMANT9", {
        lastActiveAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      // When
      const dormantSince = await dormancy().findDormantSince(owner.userId);
      // Then
      expect(dormantSince).toBe("2026-01-01");
    });

    it("지워진 계정은 휴면으로 보지 않는다", async () => {
      // When
      const dormantSince = await dormancy().findDormantSince("no-such-user");
      // Then
      expect(dormantSince).toBeNull();
    });

    it("유효한 유료 사용자는 오래 안 열어도 휴면이 아니다", async () => {
      // Given
      const owner = await seedUser("paid@example.com", "DORMANTP", {
        lastActiveAt: new Date("2026-01-01T00:00:00.000Z"),
        timezone: "UTC",
      });
      premiumUserIds.add(owner.userId);
      // When
      const dormantSince = await dormancy().findDormantSince(owner.userId);
      // Then
      expect(dormantSince).toBeNull();
    });
  });
});
