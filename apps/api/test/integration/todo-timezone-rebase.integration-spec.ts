import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq, gte, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";

import { RefreshPushTimezoneUseCase } from "#api/modules/identity/preferences/application/use-cases/refresh-push-timezone.use-case";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { TODO_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders.public";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { MaterializeDueTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-due-todo-series.use-case";
import { MaterializeTodoSeriesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-series.use-case";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { CreateTodoUseCase } from "#api/modules/planning/todos/application/use-cases/create-todo.use-case";
import { EditTodoUseCase } from "#api/modules/planning/todos/application/use-cases/edit-todo.use-case";
import { RebaseTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/rebase-todo-timezone.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { TodoTimezoneRebaseQueueService } from "#api/modules/planning/todos/infrastructure/jobs/todo-timezone-rebase-enqueuer.adapter";
import {
  TODO_TIMEZONE_REBASE_QUEUE,
  TODO_TIMEZONE_REBASE_WINDOW_MS,
} from "#api/modules/planning/todos/infrastructure/jobs/todo-timezone-rebase.queue";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  notification,
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { SystemClock } from "#api/platform/time/system-clock";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import {
  localDateInTimezone,
  parseLocalDateTime,
  todayInTimezone,
  toLocalTimeString,
} from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";
import { DateClock } from "#test/doubles/platform/date-clock";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";
import { suppressLogger } from "../setup/suppress-logger.js";

const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";
const SCHEMA = "pgboss";
const HOUR_MS = 60 * 60 * 1000;

describe("시간대 재계산 (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let useCase: RebaseTodoTimezoneUseCase;
  let queue: TodoTimezoneRebaseQueueService;
  let reminderAdapter: ReminderSchedulerAdapter;
  let userId: string;
  let categoryId: number;
  let today: string;
  let transaction: ReturnType<typeof createDatabaseTransactionFixture>;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: true,
      createSchema: true,
    });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
    });
    transaction = createDatabaseTransactionFixture(client);
    jobQueue = new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
      shutdownTimeoutMs: 10_000,
    });
    await jobQueue.start();
    reminderAdapter = new ReminderSchedulerAdapter(
      new TodoReminderSchedulerAdapter(jobQueue, new DateClock()),
    );
    queue = new TodoTimezoneRebaseQueueService(jobQueue);
    useCase = new RebaseTodoTimezoneUseCase({
      clock: new DateClock(),
      todoRepository: new DrizzleTodoRepository(transaction.txHost, new DateClock()),
      seriesRepository: new DrizzleTodoSeriesRepository(transaction.txHost, new DateClock()),
      ownerTimezone: {
        findTimezone: async (id) => {
          const row = await transaction.txHost.tx.query.userPreference.findFirst({
            columns: { timezone: true },
            where: { userId: id.value },
          });
          return row?.timezone ?? null;
        },
      },
      todoReminder: reminderAdapter,
      todoCache: { invalidateFriendTodos: async () => undefined },
      unitOfWork: transaction.uow,
      mutationLock: new PostgresMutationLockAdapter(transaction.txHost),
      logger: { log: () => undefined },
    });
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    await client.execute(
      sql.raw(
        `DELETE FROM ${SCHEMA}.job WHERE name IN ('${TODO_REMINDER_QUEUE}', '${TODO_TIMEZONE_REBASE_QUEUE.name}')`,
      ),
    );
    const user = UserFixture.create({
      id: createEntityId(),
      email: "rebase@example.com",
      userTag: "REBASE01",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    await client.insert(userPreference).values({ userId, timezone: NEW_YORK });
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    categoryId = category?.id ?? 0;
    today = toDateString(todayInTimezone(NEW_YORK));
  });

  afterAll(async () => {
    await jobQueue?.stop();
    await database?.stop();
  });

  async function seedTodo(date: string, localTime: string, overrides: object = {}) {
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId, categoryId }), ["id"]),
        startDate: Temporal.PlainDate.from(date),
        scheduledLocalTime: localTime,
        scheduledTime: instantFromDate(parseLocalDateTime(date, localTime, SEOUL)),
        isAllDay: false,
        ...overrides,
      })
      .returning();
    return row?.id ?? 0;
  }

  async function readInstant(id: number) {
    const row = await client.query.todo.findFirst({
      columns: { scheduledTime: true },
      where: { id },
    });
    return row?.scheduledTime == null ? undefined : toIsoString(row.scheduledTime);
  }

  async function queuedStarts(todoId: number, label: string) {
    const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, {
      key: `reminder_${todoId}_${label}`,
      queued: true,
    });
    return jobs.map((job) => job.startAfter.getTime());
  }

  async function queuedJobCount() {
    const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, { queued: true });
    return jobs.length;
  }

  function setStoredTimezone(timezone: string) {
    return client.update(userPreference).set({ timezone }).where(eq(userPreference.userId, userId));
  }

  it("옛 예약을 지우고 새 시각으로 다시 예약하며 벽시계는 그대로다", async () => {
    // Given
    const date = addDaysToDateKey(today, 3);
    const id = await seedTodo(date, "10:00");
    const seoulInstant = instantFromDate(parseLocalDateTime(date, "10:00", SEOUL));
    await reminderAdapter.scheduleReminders([{ todoId: id, scheduledTime: seoulInstant, userId }]);
    // When
    const result = await useCase.execute({ userId });
    // Then
    const expected = parseLocalDateTime(date, "10:00", NEW_YORK);
    expect(result).toMatchObject({ outcome: "COMPLETED", rebasedCount: 1 });
    expect(await readInstant(id)).toBe(expected.toISOString());
    const starts = await queuedStarts(id, "60min");
    expect(starts).toHaveLength(1);
    expect(Math.abs((starts[0] ?? 0) - (expected.getTime() - HOUR_MS))).toBeLessThan(5000);
    const row = await client.query.todo.findFirst({ where: { id } });
    expect(row?.scheduledLocalTime).toBe("10:00");
  });

  it("새 시간대에서 이미 지난 시각은 옛 예약을 지우고 다시 예약하지 않는다", async () => {
    // Given
    const yesterday = addDaysToDateKey(today, -1);
    const id = await seedTodo(yesterday, "00:00", {
      scheduledTime: nowInstant().add({ milliseconds: 5 * HOUR_MS }),
    });
    await reminderAdapter.scheduleReminders([
      { todoId: id, scheduledTime: nowInstant().add({ milliseconds: 5 * HOUR_MS }), userId },
    ]);
    // When
    const result = await useCase.execute({ userId });
    // Then
    expect(result.rebasedCount).toBe(1);
    expect(await queuedStarts(id, "60min")).toEqual([]);
    expect(await queuedStarts(id, "10min")).toEqual([]);
  });

  it("새 시간대에서 10분 안쪽으로 남으면 바로 보내지 않고 건너뛴다", async () => {
    // Given
    const soon = new Date(Date.now() + 5 * 60 * 1000);
    const localTime = toLocalTimeString(soon, NEW_YORK);
    const id = await seedTodo(localDateInTimezone(soon, NEW_YORK), localTime, {
      scheduledTime: nowInstant().add({ milliseconds: 5 * HOUR_MS }),
    });
    await reminderAdapter.scheduleReminders([
      { todoId: id, scheduledTime: nowInstant().add({ milliseconds: 5 * HOUR_MS }), userId },
    ]);
    // When
    const result = await useCase.execute({ userId });
    // Then
    expect(result.rebasedCount).toBe(1);
    expect(await queuedJobCount()).toBe(0);
  });

  it("완료했거나 지난 할 일은 순간만 바꾸고 예약은 만들지 않는다", async () => {
    // Given
    const future = addDaysToDateKey(today, 3);
    const past = addDaysToDateKey(today, -400);
    const completedFuture = await seedTodo(future, "10:00", { completed: true });
    const completedPast = await seedTodo(past, "10:00", { completed: true });
    const openPast = await seedTodo(past, "11:00");
    const open = await seedTodo(future, "12:00");
    // When
    const result = await useCase.execute({ userId });
    // Then
    expect(result).toMatchObject({ scannedCount: 4, rebasedCount: 4 });
    expect(await readInstant(completedFuture)).toBe(
      parseLocalDateTime(future, "10:00", NEW_YORK).toISOString(),
    );
    expect(await readInstant(completedPast)).toBe(
      parseLocalDateTime(past, "10:00", NEW_YORK).toISOString(),
    );
    expect(await readInstant(openPast)).toBe(
      parseLocalDateTime(past, "11:00", NEW_YORK).toISOString(),
    );
    expect(await queuedStarts(completedFuture, "60min")).toEqual([]);
    expect(await queuedStarts(completedPast, "60min")).toEqual([]);
    expect(await queuedStarts(openPast, "60min")).toEqual([]);
    expect(await queuedStarts(open, "60min")).toHaveLength(1);
    expect(await queuedStarts(open, "10min")).toHaveLength(1);
  });

  it("왕복 여행과 중복 실행 뒤에도 예약은 회차·단계마다 하나다", async () => {
    // Given
    const date = addDaysToDateKey(today, 3);
    const id = await seedTodo(date, "10:00");
    const seoulInstant = instantFromDate(parseLocalDateTime(date, "10:00", SEOUL));
    await reminderAdapter.scheduleReminders([{ todoId: id, scheduledTime: seoulInstant, userId }]);
    // When
    await useCase.execute({ userId });
    await useCase.execute({ userId });
    await setStoredTimezone(SEOUL);
    await useCase.execute({ userId });
    await useCase.execute({ userId });
    // Then
    expect(await readInstant(id)).toBe(toIsoString(seoulInstant));
    const starts = await queuedStarts(id, "60min");
    expect(starts).toHaveLength(1);
    expect(Math.abs((starts[0] ?? 0) - (seoulInstant.epochMilliseconds - HOUR_MS))).toBeLessThan(
      5000,
    );
    expect(await queuedStarts(id, "10min")).toHaveLength(1);
  });

  it("규칙 시간대를 바꾸고 다른 사용자의 규칙은 건드리지 않는다", async () => {
    // Given
    const other = UserFixture.create({
      id: createEntityId(),
      email: "rebase-other@example.com",
      userTag: "REBASE02",
    });
    await client.insert(userTable).values(other);
    const seedSeries = async (owner: string, timezone: string, id: string) => {
      const [category] = await client
        .insert(todoCategory)
        .values(omit(TodoCategoryFixture.create({ userId: owner, sortOrder: 1 }), ["id"]))
        .returning();
      await client.insert(todoSeries).values({
        id,
        originSeriesId: id,
        userId: owner,
        categoryId: category?.id ?? 0,
        title: "회차",
        visibility: "PUBLIC",
        scheduledLocalTime: "10:00",
        timezone,
        repeatFrequency: "DAILY",
        repeatInterval: 1,
        startDate: Temporal.PlainDate.from(today),
        checklistTemplate: [],
        nextOccurrenceDate: Temporal.PlainDate.from(today),
        generatedCount: 0,
        updatedAt: nowInstant(),
      });
    };
    await seedSeries(userId, SEOUL, "00000000-0000-4000-8000-000000000a01");
    await seedSeries(other.id, SEOUL, "00000000-0000-4000-8000-000000000a02");
    // When
    const result = await useCase.execute({ userId });
    // Then
    expect(result.seriesCount).toBe(1);
    const rows = await client.query.todoSeries.findMany({ columns: { id: true, timezone: true } });
    expect(rows.find((row) => row.id.endsWith("a01"))?.timezone).toBe(NEW_YORK);
    expect(rows.find((row) => row.id.endsWith("a02"))?.timezone).toBe(SEOUL);
  });

  it("중간에 실패하면 그 묶음만 되돌아가고 재시도가 나머지를 끝낸다", async () => {
    // Given
    const date = addDaysToDateKey(today, 3);
    const ids = [await seedTodo(date, "10:00"), await seedTodo(date, "11:00")];
    const transaction = createDatabaseTransactionFixture(client);
    let failed = false;
    const flaky = new RebaseTodoTimezoneUseCase({
      clock: new DateClock(),
      todoRepository: new DrizzleTodoRepository(transaction.txHost, new DateClock()),
      seriesRepository: new DrizzleTodoSeriesRepository(transaction.txHost, new DateClock()),
      ownerTimezone: { findTimezone: async () => NEW_YORK },
      todoReminder: {
        cancelReminders: async () => undefined,
        scheduleReminders: async () => {
          if (!failed) {
            failed = true;
            throw new Error("synthetic queue failure");
          }
        },
      },
      todoCache: { invalidateFriendTodos: async () => undefined },
      unitOfWork: transaction.uow,
      mutationLock: new PostgresMutationLockAdapter(transaction.txHost),
      logger: { log: () => undefined },
      batchSize: 1,
    });
    // When
    await expect(flaky.execute({ userId })).rejects.toThrow("synthetic queue failure");
    const afterFailure = await readInstant(ids[0] ?? 0);
    const retried = await flaky.execute({ userId });
    // Then
    expect(afterFailure).toBe(parseLocalDateTime(date, "10:00", SEOUL).toISOString());
    expect(retried).toMatchObject({ outcome: "COMPLETED", rebasedCount: 2 });
    expect(await readInstant(ids[1] ?? 0)).toBe(
      parseLocalDateTime(date, "11:00", NEW_YORK).toISOString(),
    );
  });

  it("같은 구간의 변경은 작업 하나로 묶이고 다음 구간은 새 작업이 된다", async () => {
    // Given
    const windowStart = Math.floor(Date.now() / TODO_TIMEZONE_REBASE_WINDOW_MS);
    const first = new Date(windowStart * TODO_TIMEZONE_REBASE_WINDOW_MS + 1000);
    const sameWindow = new Date(windowStart * TODO_TIMEZONE_REBASE_WINDOW_MS + 30_000);
    const nextWindow = new Date((windowStart + 1) * TODO_TIMEZONE_REBASE_WINDOW_MS + 1000);
    // When
    await queue.enqueueRebase(userId, first);
    await queue.enqueueRebase(userId, sameWindow);
    await queue.enqueueRebase(userId, nextWindow);
    // Then
    const jobs = await boss.findJobs(TODO_TIMEZONE_REBASE_QUEUE.name, { queued: true });
    const mine = jobs.filter((job) => job.singletonKey?.includes(userId));
    expect(mine).toHaveLength(2);
    expect(Math.min(...mine.map((job) => job.startAfter.getTime()))).toBeGreaterThan(
      first.getTime(),
    );
  });

  it.each([
    {
      name: "폰(뉴욕) → 태블릿(서울) → 폰(뉴욕)",
      requests: [NEW_YORK, SEOUL, NEW_YORK],
      last: NEW_YORK,
    },
    {
      name: "폰(뉴욕) → 태블릿(서울)을 다섯 번 왕복한 뒤 태블릿",
      requests: [
        NEW_YORK,
        SEOUL,
        NEW_YORK,
        SEOUL,
        NEW_YORK,
        SEOUL,
        NEW_YORK,
        SEOUL,
        NEW_YORK,
        SEOUL,
      ],
      last: SEOUL,
    },
    {
      name: "환승(런던 → 두바이 → 뉴욕)",
      requests: ["Europe/London", "Asia/Dubai", NEW_YORK],
      last: NEW_YORK,
    },
  ])(
    "기기 두 대 $name: 같은 분의 전환은 작업 하나이고 결과는 마지막 값이다",
    async ({ requests, last }) => {
      // Given
      const date = addDaysToDateKey(today, 3);
      const id = await seedTodo(date, "10:00");
      await reminderAdapter.scheduleReminders([
        {
          todoId: id,
          scheduledTime: instantFromDate(parseLocalDateTime(date, "10:00", SEOUL)),
          userId,
        },
      ]);
      await setStoredTimezone(SEOUL);
      const at = new Date(
        Math.floor(Date.now() / TODO_TIMEZONE_REBASE_WINDOW_MS) * TODO_TIMEZONE_REBASE_WINDOW_MS +
          1000,
      );
      const preferenceRepository = new DrizzleUserPreferenceRepository(transaction.txHost);
      const refresh = new RefreshPushTimezoneUseCase({
        preferenceRepository,
        cache: { invalidateUserPreference: async () => undefined },
        reminderTimezoneCache: { invalidateActiveTimezones: async () => undefined },
        todoTimezoneRebase: { enqueueRebase: (user) => queue.enqueueRebase(user.value, at) },
        unitOfWork: transaction.uow,
        clock: new SystemClock(),
      });
      // When
      for (const timezone of requests) {
        await refresh.execute({ userId, timezone });
      }
      // Then
      const jobs = await boss.findJobs(TODO_TIMEZONE_REBASE_QUEUE.name, { queued: true });
      expect(jobs.filter((job) => job.singletonKey?.includes(userId))).toHaveLength(1);
      await useCase.execute({ userId });
      expect(await readInstant(id)).toBe(parseLocalDateTime(date, "10:00", last).toISOString());
      expect(await queuedStarts(id, "60min")).toHaveLength(1);
    },
  );

  it("활성 트랜잭션이 되돌아가면 재계산 작업도 등록되지 않는다", async () => {
    // Given
    const transaction = createDatabaseTransactionFixture(client);
    const localQueue = new TodoTimezoneRebaseQueueService(
      new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
        shutdownTimeoutMs: 10_000,
      }),
    );
    const at = new Date(Date.now() + 10 * TODO_TIMEZONE_REBASE_WINDOW_MS);
    // When
    await expect(
      transaction.uow.run(async () => {
        await localQueue.enqueueRebase(userId, at);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    // Then
    const jobs = await boss.findJobs(TODO_TIMEZONE_REBASE_QUEUE.name, { queued: true });
    expect(jobs.filter((job) => job.singletonKey?.includes(userId))).toHaveLength(0);
  });

  it("실제 worker가 구간이 지난 작업을 실행해 시각을 고친다", async () => {
    // Given
    const date = addDaysToDateKey(today, 3);
    const id = await seedTodo(date, "10:00");
    const done = Promise.withResolvers<void>();
    await jobQueue.work(
      { ...TODO_TIMEZONE_REBASE_QUEUE, worker: { localConcurrency: 1, pollingIntervalSeconds: 1 } },
      async (jobs) => {
        for (const job of jobs) {
          if (job.data.data.userId === userId) {
            await useCase.execute({ userId });
            done.resolve();
          }
        }
      },
    );
    // When
    await queue.enqueueRebase(userId, new Date(Date.now() - 2 * TODO_TIMEZONE_REBASE_WINDOW_MS));
    await done.promise;
    // Then
    expect(await readInstant(id)).toBe(parseLocalDateTime(date, "10:00", NEW_YORK).toISOString());
  }, 30_000);

  it("이미 울린 단계는 하루가 넘게 지나 다시 돌아도 알림을 또 남기지 않는다", async () => {
    // Given
    const date = addDaysToDateKey(today, 1);
    const id = await seedTodo(date, "10:00");
    const insert = () =>
      client
        .insert(notification)
        .values({
          userId,
          type: "TODO_REMINDER",
          title: "t",
          body: "b",
          todoId: id,
          metadata: { stage: "60min" },
          reminderOccurrenceKey: `${date}T10:00`,
          createdAt: nowInstant().subtract({ milliseconds: 30 * HOUR_MS }),
        })
        .onConflictDoNothing()
        .returning({ id: notification.id });
    // When
    const first = await insert();
    const second = await insert();
    // Then
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});

describe("Todo.scheduledLocalTime 이관 (실제 PostgreSQL)", () => {
  const MIGRATIONS_DIR = join(process.cwd(), "drizzle");
  const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 4 }) });
  let client: TestDatabaseClient;

  function readBackfill(): string {
    const folder = readdirSync(MIGRATIONS_DIR).find((name) =>
      name.endsWith("_todo_scheduled_local_time"),
    );
    const statements = readFileSync(join(MIGRATIONS_DIR, folder ?? "", "migration.sql"), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim());
    return statements.find((statement) => statement.includes('UPDATE "Todo"')) ?? "";
  }

  beforeAll(async () => {
    client = await database.start();
  });
  beforeEach(async () => {
    await database.cleanup();
  });
  afterAll(async () => {
    await database.stop();
  });

  async function seedUser(tag: string, timezone: string | null) {
    const user = UserFixture.create({
      id: createEntityId(),
      email: `${tag}@example.com`,
      userTag: tag,
    });
    await client.insert(userTable).values(user);
    if (timezone != null) {
      await client.insert(userPreference).values({ userId: user.id, timezone });
    }
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: user.id, sortOrder: 0 }), ["id"]))
      .returning();
    return { userId: user.id, categoryId: category?.id ?? 0 };
  }

  async function seedRow(
    owner: { userId: string; categoryId: number },
    scheduledTime: Temporal.Instant | null,
    overrides: object = {},
  ) {
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create(owner), ["id"]),
        startDate: Temporal.PlainDate.from("2026-11-05"),
        scheduledTime,
        scheduledLocalTime: null,
        isAllDay: scheduledTime == null,
        ...overrides,
      })
      .returning();
    return row;
  }

  it.each([
    { name: "서울 사용자", tag: "BF000001", timezone: SEOUL, local: "10:00" },
    { name: "뉴욕 사용자", tag: "BF000002", timezone: NEW_YORK, local: "20:00" },
    { name: "진짜 UTC 사용자", tag: "BF000003", timezone: "UTC", local: "01:00" },
    { name: "설정 없는 사용자", tag: "BF000004", timezone: null, local: "10:00" },
    { name: "잘못된 시간대", tag: "BF000005", timezone: "Mars/Phobos", local: "10:00" },
  ])("$name: 순간은 그대로 두고 벽시계를 채운다", async ({ tag, timezone, local }) => {
    // Given
    const owner = await seedUser(tag, timezone);
    const instant = Temporal.Instant.from("2026-11-05T01:00:00.000Z");
    const row = await seedRow(owner, instant);
    const allDay = await seedRow(owner, null);
    // When
    await client.execute(sql.raw(readBackfill()));
    // Then
    const filled = await client.query.todo.findFirst({ where: { id: row?.id ?? 0 } });
    const untouched = await client.query.todo.findFirst({ where: { id: allDay?.id ?? 0 } });
    expect(filled?.scheduledLocalTime).toBe(local);
    expect(filled?.scheduledTime).toEqual(instant);
    expect(filled?.updatedAt).toEqual(row?.updatedAt);
    expect(untouched?.scheduledLocalTime).toBeNull();
  });
});

describe("시간대 재계산 동시성 (실제 PostgreSQL 잠금)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let categoryId: number;
  let today: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
  });
  beforeEach(async () => {
    await context.reset();
    const user = UserFixture.create({
      id: createEntityId(),
      email: "rebase-race@example.com",
      userTag: "REBASE03",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    await client.insert(userPreference).values({ userId, timezone: NEW_YORK });
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    categoryId = category?.id ?? 0;
    today = toDateString(todayInTimezone(NEW_YORK));
  });
  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function createDailySeries(time: string) {
    const { series, todos } = await context.module.get(CreateTodoUseCase).execute({
      userId: UserId.reconstitute(userId),
      title: "회차",
      categoryId: TodoCategoryId.reconstitute(categoryId),
      startDate: Temporal.PlainDate.from(addDaysToDateKey(today, 1)),
      scheduledTime: time,
      timezone: SEOUL,
      isAllDay: false,
      repeat: { frequency: "DAILY", end: { type: "NEVER" } },
    });
    return { seriesId: series?.id ?? "", todos };
  }

  async function assertEveryRowMatchesWallClock(timezone: string) {
    const rows = await client.query.todo.findMany({
      where: { userId, completed: false, scheduledTime: { isNotNull: true } },
    });
    expect(rows.length).toBeGreaterThan(0);
    const wrong = rows.filter(
      (row) =>
        row.scheduledTime?.epochMilliseconds !==
        parseLocalDateTime(
          row.startDate.toString(),
          row.scheduledLocalTime ?? "",
          timezone,
        ).getTime(),
    );
    expect(wrong.map((row) => row.id)).toEqual([]);
  }

  it("재계산·이후 모두 수정·회차 채우기·새 할 일이 겹쳐도 교착 없이 벽시계와 맞는다", async () => {
    // Given
    const { todos } = await createDailySeries("09:00");
    await createDailySeries("18:00");
    const target = todos[3];
    const rebase = context.module.get(RebaseTodoTimezoneUseCase);
    const edit = context.module.get(EditTodoUseCase);
    const create = context.module.get(CreateTodoUseCase);
    const materialize = context.module.get(MaterializeDueTodoSeriesUseCase);
    // When
    const outcomes = await Promise.allSettled([
      rebase.execute({ userId }),
      edit.execute({
        id: target?.id ?? 0,
        userId,
        timezone: NEW_YORK,
        scope: "THIS_AND_FOLLOWING",
        data: { scheduledTime: "10:30", isAllDay: false },
      }),
      materialize.execute(),
      create.execute({
        userId: UserId.reconstitute(userId),
        title: "새 할 일",
        categoryId: TodoCategoryId.reconstitute(categoryId),
        startDate: Temporal.PlainDate.from(addDaysToDateKey(today, 2)),
        scheduledTime: "07:15",
        timezone: NEW_YORK,
        isAllDay: false,
      }),
      rebase.execute({ userId }),
    ]);
    await rebase.execute({ userId });
    // Then
    expect(outcomes.map((outcome) => outcome.status)).not.toContain("rejected");
    await assertEveryRowMatchesWallClock(NEW_YORK);
    const series = await client.query.todoSeries.findMany({ where: { userId } });
    expect(series.every((row) => row.timezone === NEW_YORK)).toBe(true);
  });

  it("단건 수정과 겹쳐도 수정한 벽시계로 계산된다", async () => {
    // Given
    const date = addDaysToDateKey(today, 2);
    const { todos } = await context.module.get(CreateTodoUseCase).execute({
      userId: UserId.reconstitute(userId),
      title: "단건",
      categoryId: TodoCategoryId.reconstitute(categoryId),
      startDate: Temporal.PlainDate.from(date),
      scheduledTime: "09:00",
      timezone: SEOUL,
      isAllDay: false,
    });
    const id = todos[0]?.id ?? 0;
    const rebase = context.module.get(RebaseTodoTimezoneUseCase);
    const edit = context.module.get(EditTodoUseCase);
    // When
    const outcomes = await Promise.allSettled([
      rebase.execute({ userId }),
      edit.execute({
        id,
        userId,
        timezone: NEW_YORK,
        data: { scheduledTime: "21:00", isAllDay: false },
      }),
      rebase.execute({ userId }),
    ]);
    await rebase.execute({ userId });
    // Then
    expect(outcomes.map((outcome) => outcome.status)).not.toContain("rejected");
    const row = await client.query.todo.findFirst({ where: { id } });
    expect(row?.scheduledLocalTime).toBe("21:00");
    expect(row?.scheduledTime).toEqual(
      instantFromDate(parseLocalDateTime(date, "21:00", NEW_YORK)),
    );
  });

  it("재계산 뒤 만드는 회차와 휴면 복귀로 채우는 회차는 새 시간대다", async () => {
    // Given
    const { seriesId } = await createDailySeries("09:00");
    await client
      .update(todoSeries)
      .set({
        nextOccurrenceDate: Temporal.PlainDate.from(addDaysToDateKey(today, 1)),
        generatedCount: 1,
      })
      .where(eq(todoSeries.id, seriesId));
    await client
      .delete(todo)
      .where(
        and(
          eq(todo.seriesId, seriesId),
          gte(todo.occurrenceDate, Temporal.PlainDate.from(addDaysToDateKey(today, 1))),
        ),
      );
    // When
    await context.module.get(RebaseTodoTimezoneUseCase).execute({ userId });
    await context.module.get(MaterializeTodoSeriesUseCase).execute(
      { id: seriesId, userId },
      {
        skipLocked: false,
      },
    );
    // Then
    await assertEveryRowMatchesWallClock(NEW_YORK);
  });
});
