import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DrizzleUserRepository } from "#api/modules/identity/users/infrastructure/persistence/drizzle-user.repository";
import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { MaterializeDueTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-due-todo-series.use-case";
import { MaterializeTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-occurrences.use-case";
import { MaterializeTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-series.use-case";
import type { PublishTodoCreationUseCase } from "#api/modules/planning/todo-series/application/use-cases/publish-todo-creation.use-case";
import { RepeatRule } from "#api/modules/planning/todo-series/domain/repeat-rule.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { TodoSeriesOwnerAdapter } from "#api/modules/planning/todo-series/infrastructure/adapters/todo-series-owner.adapter";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import type { TodoReminderSchedulerPort } from "#api/modules/planning/todos/application/ports/todo-reminder-scheduler.port";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { StubCurrentUserAccess } from "#test/fixtures/auth-credential.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2026-11-05T00:00:00.000Z");
const HORIZON_ROWS = 91;

describe("회차 채우기 작업 (실제 PostgreSQL)", () => {
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
  let client: TestDatabaseClient;
  let fixture: ReturnType<typeof createDatabaseTransactionFixture>;
  let userId: string;
  let categoryId: number;
  let published: string[];

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    fixture = createDatabaseTransactionFixture(client);
    published = [];
    const seeded = await seedUser("series-job@example.com", "SERJOB01");
    userId = seeded.userId;
    categoryId = seeded.categoryId;
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(async () => {
    await database.stop();
  });

  async function seedUser(email: string, userTag: string) {
    const user = UserFixture.create({ id: createEntityId(), email, userTag, status: "ACTIVE" });
    await client.insert(userTable).values(user);
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: user.id, sortOrder: 0 }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    return { userId: user.id, categoryId: category.id };
  }

  function useCase(
    overrides: {
      batchSize?: number;
      scheduleReminders?: TodoReminderSchedulerPort["scheduleReminders"];
    } = {},
  ) {
    const { scheduleReminders = async () => undefined, ...budget } = overrides;
    const todoRepository = new DrizzleTodoRepository(fixture.txHost);
    const effects: Pick<PublishTodoCreationUseCase, "publishOccurrences"> = {
      publishOccurrences: async (series) => {
        published.push(series.id.value);
      },
    };
    const seriesRepository = new DrizzleTodoSeriesRepository(fixture.txHost);
    const entitlements = new StubCurrentUserAccess();
    return new MaterializeDueTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository,
      seriesOwner: new TodoSeriesOwnerAdapter(
        new DrizzleUserRepository(fixture.txHost),
        entitlements,
      ),
      dueRunner: new MaterializeTodoSeriesUseCase({
        clock: new DateClock(),
        seriesRepository,
        materializer: new MaterializeTodoOccurrencesUseCase({
          todoRepository,
          todoReminder: { scheduleReminders },
          applyTodoEvents: { execute: async () => undefined },
        }),
        effects,
        unitOfWork: fixture.uow,
        mutationLock: new PostgresMutationLockAdapter(fixture.txHost),
      }),
      alert: new RecordingOperationalAlert(),
      logger: new Logger("SeriesJobIntegration"),
      ...budget,
    });
  }

  async function seedSeries(
    id: string,
    overrides: { userId?: string; categoryId?: number; startDate?: string } = {},
  ) {
    const series = TodoSeries.create({
      id: TodoSeriesId.reconstitute(id),
      userId: UserId.reconstitute(overrides.userId ?? userId),
      categoryId: overrides.categoryId ?? categoryId,
      title: TodoTitle.create("매일 반복"),
      visibility: "PUBLIC",
      scheduledLocalTime: "09:00",
      timezone: "UTC",
      rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
      startDate: overrides.startDate ?? "2026-11-05",
      checklistTemplate: [{ title: "항목" }],
      now: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
    });
    await new DrizzleTodoSeriesRepository(fixture.txHost).insert(series);
    return series;
  }

  function countOccurrences(seriesId: string) {
    return client.$count(todo, eq(todo.seriesId, seriesId));
  }

  async function nextOccurrenceOf(seriesId: string) {
    const row = await client.query.todoSeries.findFirst({ where: { id: seriesId } });
    return row?.nextOccurrenceDate?.toISOString().slice(0, 10) ?? null;
  }

  it("미리 만드는 기간까지 만들고 다음 회차로 커서를 옮기며 다시 돌아도 그대로다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    // When
    const first = await useCase().execute();
    const again = await useCase().execute();
    // Then
    expect(first.createdCount).toBe(HORIZON_ROWS);
    expect(again.createdCount).toBe(0);
    expect(await countOccurrences(id)).toBe(HORIZON_ROWS);
    expect(await nextOccurrenceOf(id)).toBe("2027-02-04");
    expect(await client.$count(todoSeries, eq(todoSeries.generatedCount, HORIZON_ROWS))).toBe(1);
  });

  it("리마인더 등록이 실패하면 회차와 커서가 함께 되돌아가 다음 실행이 다시 만든다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    const scheduled: number[] = [];
    // When
    const failed = await useCase({
      scheduleReminders: async () => {
        throw new Error("queue unavailable");
      },
    }).execute();
    const retried = await useCase({
      scheduleReminders: async (reminders) => {
        scheduled.push(...reminders.map(({ todoId }) => todoId));
      },
    }).execute();
    // Then
    expect(failed.failedCount).toBe(1);
    expect(failed.createdCount).toBe(0);
    expect(retried.createdCount).toBe(HORIZON_ROWS);
    expect(scheduled).toHaveLength(HORIZON_ROWS);
    expect(await countOccurrences(id)).toBe(HORIZON_ROWS);
  });

  it("다음 날 실행은 하루 치만 더 만든다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    await useCase().execute();
    vi.setSystemTime(new Date("2026-11-06T00:00:00.000Z"));
    // When
    const result = await useCase().execute();
    // Then
    expect(result.createdCount).toBe(1);
    expect(await nextOccurrenceOf(id)).toBe("2027-02-05");
  });

  it("두 실행이 동시에 돌아도 회차가 중복되지 않는다", async () => {
    // Given
    const ids = [createEntityId(), createEntityId(), createEntityId()];
    for (const id of ids) {
      await seedSeries(id);
    }
    // When
    await Promise.all([useCase().execute(), useCase().execute()]);
    await useCase().execute();
    // Then
    for (const id of ids) {
      expect(await countOccurrences(id)).toBe(HORIZON_ROWS);
      const dates = await client
        .select({ count: sql<number>`count(distinct ${todo.occurrenceDate})::int` })
        .from(todo)
        .where(eq(todo.seriesId, id));
      expect(dates[0]?.count).toBe(HORIZON_ROWS);
    }
  });

  it("다른 트랜잭션이 규칙을 잡고 있으면 기다리지 않고 건너뛰고 다음 실행이 이어받는다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    const held = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const holder = client.transaction(async (tx) => {
      await tx.execute(sql`SELECT "id" FROM "TodoSeries" WHERE "id" = ${id} FOR UPDATE`);
      held.resolve();
      await release.promise;
    });
    await held.promise;
    let skipped;
    try {
      // When
      skipped = await useCase().execute();
    } finally {
      release.resolve();
      await holder;
    }
    const resumed = await useCase().execute();
    // Then
    expect(skipped.createdCount).toBe(0);
    expect(resumed.createdCount).toBe(HORIZON_ROWS);
  });

  it("id 순 커서로 배치 크기를 넘는 규칙을 모두 처리한다", async () => {
    // Given
    const ids = ["a", "b", "c", "d", "e"].map((prefix) => `${prefix}-${createEntityId()}`);
    for (const id of ids) {
      await seedSeries(id);
    }
    // When
    const result = await useCase({ batchSize: 2 }).execute();
    // Then
    expect(result.processedCount).toBe(ids.length);
    expect(published).toEqual(ids);
  });

  it("며칠 멈췄다 돌면 커서가 앞서 있어 지난 날 없이 밀린 만큼만 채운다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    await useCase().execute();
    vi.setSystemTime(new Date("2026-11-11T00:00:00.000Z"));
    // When
    const result = await useCase().execute();
    // Then
    expect(result.createdCount).toBe(6);
    expect(await nextOccurrenceOf(id)).toBe("2027-02-10");
    const first = await client.query.todo.findFirst({
      where: { seriesId: id },
      orderBy: { occurrenceDate: "asc" },
    });
    expect(first?.startDate.toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("이미 있는 회차는 건너뛰고 새로 만든 행만 센다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    const occurrenceDate = new Date("2026-11-05T00:00:00.000Z");
    const [existing] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId, categoryId, sortOrder: 0 }), ["id"]),
        seriesId: id,
        occurrenceDate,
        startDate: occurrenceDate,
      })
      .returning();
    // When
    const result = await useCase().execute();
    // Then
    expect(await countOccurrences(id)).toBe(HORIZON_ROWS);
    expect(result.createdCount).toBe(HORIZON_ROWS - 1);
    expect(await client.$count(todo, eq(todo.id, existing?.id ?? 0))).toBe(1);
  });

  it("회차는 체크리스트를 복사하고 규칙의 createdAt을 물려받는다", async () => {
    // Given
    const id = createEntityId();
    await seedSeries(id);
    vi.setSystemTime(new Date("2026-11-05T03:00:00.000Z"));
    // When
    await useCase().execute();
    // Then
    const row = await client.query.todo.findFirst({
      where: { seriesId: id },
      with: { items: true },
    });
    expect(row?.createdAt).toEqual(AT);
    expect(row?.items.map((item) => item.title)).toEqual(["항목"]);
  });

  it.each([
    { name: "정지", patch: { status: "SUSPENDED" as const } },
    { name: "탈퇴 대기", patch: { deletedAt: AT } },
  ])("$name 계정은 건너뛰고 커서를 그대로 둔다", async ({ patch }) => {
    // Given
    const other = await seedUser("series-job-other@example.com", "SERJOB02");
    const id = createEntityId();
    await seedSeries(id, other);
    await client.update(userTable).set(patch).where(eq(userTable.id, other.userId));
    // When
    const result = await useCase().execute();
    // Then
    expect(result.processedCount).toBe(0);
    expect(await countOccurrences(id)).toBe(0);
    expect(await nextOccurrenceOf(id)).toBe("2026-11-05");
  });

  describe("1.14.2로 되돌린 동안 카테고리가 지워진 규칙", () => {
    /** 롤백 SQL 뒤 옛 서버처럼 카테고리를 지운다. 할 일만 옮기고 규칙은 없는 카테고리를 가리킨다. */
    async function deleteCategoryLikeOldServer(from: number, to: number) {
      await client.execute(
        sql.raw(`ALTER TABLE "TodoSeries" DROP CONSTRAINT "TodoSeries_categoryId_fkey"`),
      );
      await client.update(todo).set({ categoryId: to }).where(eq(todo.categoryId, from));
      await client.delete(todoCategory).where(eq(todoCategory.id, from));
    }

    function redeployStatements(): string {
      const deployment = readFileSync(
        join(process.cwd(), "../../docs/releases/1.15.0/server-rollback.md"),
        "utf8",
      );
      const block = /```sql\n(BEGIN;[\s\S]*?COMMIT;)\n```/.exec(deployment)?.[1];
      if (block == null) {
        throw new Error("1.15.0 되돌리기 문서에 재배포 SQL이 없다");
      }
      return block;
    }

    async function seedOtherCategory() {
      const [other] = await client
        .insert(todoCategory)
        .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 1 }), ["id"]))
        .returning();
      if (other == null) {
        throw new Error("카테고리 fixture 누락");
      }
      return other.id;
    }

    afterEach(async () => {
      await client.execute(
        sql.raw(`
          DELETE FROM "TodoSeries";
          ALTER TABLE "TodoSeries" DROP CONSTRAINT IF EXISTS "TodoSeries_categoryId_fkey";
          ALTER TABLE "TodoSeries" ADD CONSTRAINT "TodoSeries_categoryId_fkey"
            FOREIGN KEY ("categoryId") REFERENCES "TodoCategory"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        `),
      );
    });

    it("밤 작업은 깨진 규칙만 건너뛰고 다른 규칙은 계속 만든다", async () => {
      // Given
      const remaining = await seedOtherCategory();
      await seedSeries("broken", { categoryId });
      await seedSeries("healthy", { categoryId: remaining });
      await deleteCategoryLikeOldServer(categoryId, remaining);
      // When
      await useCase().execute();
      // Then
      expect(await countOccurrences("broken")).toBe(0);
      expect(await nextOccurrenceOf("broken")).toBe("2026-11-05");
      expect(await countOccurrences("healthy")).toBe(HORIZON_ROWS);
    });

    it("문서의 재배포 SQL은 회차가 옮겨 간 카테고리로 규칙을 옮기고 FK를 검증한다", async () => {
      // Given
      const remaining = await seedOtherCategory();
      await seedSeries("broken", { categoryId });
      await client.insert(todo).values({
        ...omit(TodoFixture.create({ userId, categoryId, sortOrder: 1 }), ["id"]),
        seriesId: "broken",
        occurrenceDate: AT,
        startDate: AT,
      });
      await deleteCategoryLikeOldServer(categoryId, remaining);
      // When
      await client.execute(sql.raw(redeployStatements()));
      // Then
      const rule = await client.query.todoSeries.findFirst({ where: { id: "broken" } });
      expect(rule?.categoryId).toBe(remaining);
      await expect(
        client.delete(todoCategory).where(eq(todoCategory.id, remaining)),
      ).rejects.toThrow();
    });

    it("회차가 없으면 사용자의 첫 카테고리로 옮기고 다음 밤 작업이 이어 만든다", async () => {
      // Given
      const remaining = await seedOtherCategory();
      await seedSeries("broken", { categoryId });
      await deleteCategoryLikeOldServer(categoryId, remaining);
      await useCase().execute();
      // When
      await client.execute(sql.raw(redeployStatements()));
      await useCase().execute();
      // Then
      const rule = await client.query.todoSeries.findFirst({ where: { id: "broken" } });
      expect(rule?.categoryId).toBe(remaining);
      expect(await countOccurrences("broken")).toBe(HORIZON_ROWS);
    });

    it("정리할 규칙이 없어도 FK를 건다", async () => {
      // Given
      await seedSeries("healthy");
      await client.execute(
        sql.raw(`ALTER TABLE "TodoSeries" DROP CONSTRAINT "TodoSeries_categoryId_fkey"`),
      );
      // When
      await client.execute(sql.raw(redeployStatements()));
      // Then
      const rule = await client.query.todoSeries.findFirst({ where: { id: "healthy" } });
      expect(rule?.categoryId).toBe(categoryId);
    });
  });

  it("계정을 지우면 규칙과 회차가 함께 사라진다", async () => {
    // Given
    const other = await seedUser("series-job-gone@example.com", "SERJOB03");
    const id = createEntityId();
    await seedSeries(id, other);
    await useCase().execute();
    // When
    await client.delete(userTable).where(eq(userTable.id, other.userId));
    // Then
    expect(await countOccurrences(id)).toBe(0);
    expect(await client.$count(todoSeries, and(eq(todoSeries.id, id)))).toBe(0);
  });
});
