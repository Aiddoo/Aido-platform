import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Test } from "@nestjs/testing";
import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";
import { z } from "zod";

import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { PublishNotificationUseCase } from "#api/modules/notification/notification-delivery.public";
import { SendNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-notification.use-case";
import { DrizzleNotificationTodoTargetReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-notification-todo-target.reader";
import { DrizzlePushDispatchStagingRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-dispatch-staging.repository";
import { TodoReminderQueueProcessor } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-queue.processor";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import {
  TODO_REMINDER_QUEUE as TODO_REMINDER_QUEUE_DEFINITION,
  todoReminderJobSchema,
} from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder.queue";
import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { notificationRetentionConfig } from "#api/modules/notification/retention/notification-retention.config";
import { DrizzleTodoSeriesRepository } from "#api/modules/planning/todo-series/infrastructure/persistence/drizzle-todo-series.repository";
import { ApplyTodoEventsUseCase } from "#api/modules/planning/todos/application/use-cases/apply-todo-events.use-case";
import { RebaseTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/rebase-todo-timezone.use-case";
import { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/resolve-todo-timezone.use-case";
import { UpdateTodoScheduleUseCase } from "#api/modules/planning/todos/application/use-cases/update-todo-schedule.use-case";
import { ReminderSchedulerAdapter } from "#api/modules/planning/todos/infrastructure/adapters/todo-reminder-scheduler.adapter";
import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { CacheService } from "#api/platform/cache/cache.service";
import { createEntityId } from "#api/platform/database/entity-id";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import {
  notification,
  pushDispatch,
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime, todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { StubNotificationRecipientLocaleReader } from "#test/doubles/notification/stub-notification-recipient-locale.reader";
import { StubTodoSeriesOwnerDormancy } from "#test/doubles/notification/stub-todo-series-owner-dormancy";
import { DateClock } from "#test/doubles/platform/date-clock";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { suppressLogger } from "../setup/suppress-logger.js";

const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";
const SCHEMA = "pgboss";
const TODO_REMINDER_QUEUE = TODO_REMINDER_QUEUE_DEFINITION.name;

type Stage = "60min" | "10min";
type Step =
  | { readonly fire: Stage }
  | { readonly move: { readonly day: number; readonly time: string | null } }
  | { readonly travel: string };

const sentMetadataSchema = z.object({ stage: z.string(), todoDate: z.string() });

const silentLogger = {
  log: () => undefined,
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe("할 일 알림 회차 중복 방지 (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let runtime: PgBossJobRuntimeAdapter;
  let reminderAdapter: ReminderSchedulerAdapter;
  let rebase: RebaseTodoTimezoneUseCase;
  let updateSchedule: UpdateTodoScheduleUseCase;
  let processor: TodoReminderQueueProcessor;
  let userId: string;
  let categoryId: number;
  let today: string;

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
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    runtime = new PgBossJobRuntimeAdapter(boss, txHost, { shutdownTimeoutMs: 10_000 });
    await runtime.start();
    const jobQueue = new PgBossJobQueueAdapter(boss, txHost, new JobQueueRegistry());
    reminderAdapter = new ReminderSchedulerAdapter(
      new TodoReminderSchedulerAdapter(jobQueue, new DateClock()),
    );
    const ownerTimezone = {
      findTimezone: async (id: string) => {
        const row = await txHost.tx.query.userPreference.findFirst({
          columns: { timezone: true },
          where: { userId: id },
        });
        return row?.timezone ?? null;
      },
    };
    const mutationLock = new PostgresMutationLockAdapter(txHost);
    const todoCache = { invalidateFriendTodos: async () => undefined };
    const todoRepository = new DrizzleTodoRepository(txHost, new DateClock());
    rebase = new RebaseTodoTimezoneUseCase({
      clock: new DateClock(),
      todoRepository,
      seriesRepository: new DrizzleTodoSeriesRepository(txHost, new DateClock()),
      ownerTimezone,
      todoReminder: reminderAdapter,
      todoCache,
      unitOfWork: uow,
      mutationLock,
      logger: silentLogger,
    });
    const eventPublisher = { publish: async () => undefined };
    updateSchedule = new UpdateTodoScheduleUseCase({
      todoRepository,
      todoReadRepository: new DrizzleTodoReadRepository(txHost),
      unitOfWork: uow,
      mutationLock,
      clock: new DateClock(),
      timezoneResolver: new ResolveTodoTimezoneUseCase({ ownerTimezone }),
      todoCache,
      applyTodoEvents: new ApplyTodoEventsUseCase({
        reminderScheduler: reminderAdapter,
        eventPublisher,
        clock: new DateClock(),
      }),
      logger: silentLogger,
    });
    const publisher = new PublishNotificationUseCase({
      sendNotification: new SendNotificationUseCase({
        notificationRepository: new DrizzleNotificationRepository(txHost),
        pushDispatchStaging: new DrizzlePushDispatchStagingRepository(txHost, new DateClock()),
        cache: { invalidateUnreadCount: async () => undefined },
        unitOfWork: uow,
        afterCommit: { register: () => undefined },
        afterCommitPublisher: { register: () => undefined },
        logger: silentLogger,
      }),
      sendNotificationWithDeduplication: { execute: async () => null },
      sendBatchNotification: { execute: async () => ({ count: 0 }) },
      todoTargetReader: new DrizzleNotificationTodoTargetReader(txHost),
    });
    const readerModule = await Test.createTestingModule({
      providers: [
        DrizzleSchedulerReader,
        { provide: TransactionHost, useValue: txHost },
        { provide: CacheService, useValue: {} },
        { provide: ClockPort, useValue: new DateClock() },
        {
          provide: notificationRetentionConfig.KEY,
          useValue: { onboardingV2: { enabled: false, treatmentPercent: 50 } },
        },
      ],
    }).compile();
    processor = new TodoReminderQueueProcessor(
      readerModule.get(DrizzleSchedulerReader),
      new StubTodoSeriesOwnerDormancy(),
      publisher,
      new StubNotificationRecipientLocaleReader(),
      jobQueue,
      new DateClock(),
      { raise: () => undefined },
    );
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    await client.execute(
      sql.raw(`DELETE FROM ${SCHEMA}.job WHERE name = '${TODO_REMINDER_QUEUE}'`),
    );
    const user = UserFixture.create({
      id: createEntityId(),
      email: "occurrence@example.com",
      userTag: "OCCUR001",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    await client.insert(userPreference).values({ userId, timezone: SEOUL });
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    categoryId = category?.id ?? 0;
    today = toDateString(todayInTimezone(SEOUL));
  });

  afterAll(async () => {
    await runtime?.stop();
    await database?.stop();
  });

  /** 사흘 뒤를 첫날로 둔다. 어느 시각에 돌려도 모든 단계가 미래다. */
  function dayKey(day: number): string {
    return addDaysToDateKey(today, 3 + day);
  }

  async function seedTodo(day: number, time: string, overrides: object = {}) {
    const date = dayKey(day);
    const scheduledTime = instantFromDate(parseLocalDateTime(date, time, SEOUL));
    const [row] = await client
      .insert(todo)
      .values({
        ...omit(TodoFixture.create({ userId, categoryId }), ["id"]),
        startDate: Temporal.PlainDate.from(date),
        scheduledLocalTime: time,
        scheduledTime,
        isAllDay: false,
        ...overrides,
      })
      .returning();
    const id = row?.id ?? 0;
    await reminderAdapter.scheduleReminder(id, scheduledTime, userId);
    return id;
  }

  /** 예약된 단계의 시각을 앞당겨 실제 큐에서 꺼내 처리하고 끝낸다. 끝난 작업 행이 남는 것까지 운영과 같다. */
  async function fireStage(todoId: number, stage: Stage): Promise<void> {
    await client.execute(
      sql`UPDATE pgboss.job SET start_after = now() - interval '1 second'
          WHERE name = ${TODO_REMINDER_QUEUE} AND singleton_key = ${`reminder_${todoId}_${stage}`}
            AND state = 'created'`,
    );
    const jobs = await boss.fetch<unknown>(TODO_REMINDER_QUEUE);
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    if (job == null) {
      return;
    }
    await processor.process(todoReminderJobSchema.parse(job.data));
    await boss.complete(TODO_REMINDER_QUEUE, job.id);
  }

  function moveTo(todoId: number, day: number, time: string | null) {
    return updateSchedule.execute({
      id: todoId,
      userId,
      schedule: {
        startDate: Temporal.PlainDate.from(dayKey(day)),
        endDate: null,
        scheduledTime: time,
        isAllDay: time == null,
      },
      timezone: undefined,
    });
  }

  async function travelTo(timezone: string) {
    await client.update(userPreference).set({ timezone }).where(eq(userPreference.userId, userId));
    await rebase.execute({ userId });
  }

  async function runSteps(todoId: number, steps: readonly Step[]) {
    for (const step of steps) {
      if ("fire" in step) {
        await fireStage(todoId, step.fire);
      } else if ("move" in step) {
        await moveTo(todoId, step.move.day, step.move.time);
      } else {
        await travelTo(step.travel);
      }
    }
  }

  /** 발송된 알림을 `<첫날 기준 며칠째> <단계>`로 읽는다. 알림 행과 푸시 outbox가 함께 하나여야 한다. */
  async function readSent(todoId: number) {
    const rows = await client.query.notification.findMany({
      where: { todoId, type: "TODO_REMINDER" },
      orderBy: { id: "asc" },
    });
    const dispatches = await client.$count(pushDispatch);
    return {
      dispatches,
      sent: rows.map((row) => {
        const metadata = sentMetadataSchema.parse(row.metadata);
        const day = [0, 1, 2, 3].find((offset) => dayKey(offset) === metadata.todoDate);
        return `D${day} ${metadata.stage}`;
      }),
    };
  }

  it("오늘 울린 할 일을 다음 날로 옮기면 새 날짜에 다시 울린다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    await fireStage(id, "60min");
    // When
    await moveTo(id, 1, "10:00");
    await fireStage(id, "60min");
    await fireStage(id, "10min");
    // Then
    expect(await readSent(id)).toEqual({
      sent: ["D0 60min", "D1 60min", "D1 10min"],
      dispatches: 3,
    });
  });

  it("서울과 뉴욕을 왕복해도 같은 날짜의 같은 단계는 한 번만 울린다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    await fireStage(id, "60min");
    // When
    await travelTo(NEW_YORK);
    await fireStage(id, "60min");
    await travelTo(SEOUL);
    await fireStage(id, "60min");
    await fireStage(id, "10min");
    await travelTo(NEW_YORK);
    await fireStage(id, "60min");
    await fireStage(id, "10min");
    // Then
    expect(await readSent(id)).toEqual({ sent: ["D0 60min", "D0 10min"], dispatches: 2 });
  });

  it.each<{ name: string; steps: readonly Step[]; sent: readonly string[] }>([
    {
      name: "다음 날로 옮기면 모든 단계가 새로 울린다",
      steps: [{ fire: "60min" }, { move: { day: 1, time: "10:00" } }, { fire: "60min" }],
      sent: ["D0 60min", "D1 60min"],
    },
    {
      name: "날짜를 옮겼다 되돌리면 이미 울린 단계는 다시 울리지 않고 남은 단계만 울린다",
      steps: [
        { fire: "60min" },
        { move: { day: 1, time: "10:00" } },
        { move: { day: 0, time: "10:00" } },
        { fire: "60min" },
        { fire: "10min" },
      ],
      sent: ["D0 60min", "D0 10min"],
    },
    {
      name: "같은 날 시간을 뒤로 옮기면 새 시각의 단계가 울린다",
      steps: [{ fire: "60min" }, { move: { day: 0, time: "15:00" } }, { fire: "60min" }],
      sent: ["D0 60min", "D0 60min"],
    },
    {
      name: "같은 날 시간을 앞으로 옮겨도 새 시각의 단계가 울린다",
      steps: [{ fire: "60min" }, { move: { day: 0, time: "08:00" } }, { fire: "60min" }],
      sent: ["D0 60min", "D0 60min"],
    },
    {
      name: "시간을 옮겼다 되돌리면 그 시각에 이미 울린 단계는 다시 울리지 않는다",
      steps: [
        { fire: "60min" },
        { move: { day: 0, time: "15:00" } },
        { move: { day: 0, time: "10:00" } },
        { fire: "60min" },
      ],
      sent: ["D0 60min"],
    },
    {
      name: "종일로 바꿨다가 같은 시각으로 돌아오면 이미 울린 단계는 다시 울리지 않는다",
      steps: [
        { fire: "60min" },
        { move: { day: 0, time: null } },
        { move: { day: 0, time: "10:00" } },
        { fire: "60min" },
      ],
      sent: ["D0 60min"],
    },
    {
      name: "시간을 옮긴 뒤 시간대를 왕복해도 새 시각의 단계는 한 번이다",
      steps: [
        { fire: "60min" },
        { move: { day: 0, time: "15:00" } },
        { fire: "60min" },
        { travel: NEW_YORK },
        { fire: "60min" },
        { travel: SEOUL },
        { fire: "60min" },
      ],
      sent: ["D0 60min", "D0 60min"],
    },
    {
      name: "날짜와 시간을 함께 옮기면 새 회차로 울린다",
      steps: [{ fire: "60min" }, { move: { day: 2, time: "07:30" } }, { fire: "10min" }],
      sent: ["D0 60min", "D2 10min"],
    },
    {
      name: "옮긴 날짜에서 시간대를 왕복해도 한 번이다",
      steps: [
        { fire: "10min" },
        { move: { day: 1, time: "10:00" } },
        { fire: "10min" },
        { travel: NEW_YORK },
        { fire: "10min" },
      ],
      sent: ["D0 10min", "D1 10min"],
    },
  ])("$name", async ({ steps, sent }) => {
    // Given
    const id = await seedTodo(0, "10:00");
    // When
    await runSteps(id, steps);
    // Then
    expect(await readSent(id)).toEqual({ sent, dispatches: sent.length });
  });

  describe("반복 회차", () => {
    const SERIES_ID = "00000000-0000-4000-8000-000000000b01";

    async function seedOccurrences() {
      await client.insert(todoSeries).values({
        id: SERIES_ID,
        originSeriesId: SERIES_ID,
        userId,
        categoryId,
        title: "회차",
        visibility: "PUBLIC",
        scheduledLocalTime: "10:00",
        timezone: SEOUL,
        repeatFrequency: "DAILY",
        repeatInterval: 1,
        startDate: Temporal.PlainDate.from(dayKey(0)),
        checklistTemplate: [],
        nextOccurrenceDate: Temporal.PlainDate.from(dayKey(3)),
        generatedCount: 3,
        updatedAt: nowInstant(),
      });
      return [
        await seedTodo(0, "10:00", { seriesId: SERIES_ID }),
        await seedTodo(1, "10:00", { seriesId: SERIES_ID }),
        await seedTodo(2, "10:00", { seriesId: SERIES_ID }),
      ] as const;
    }

    it.each<{ name: string; steps: readonly Step[]; sent: readonly string[] }>([
      {
        name: "회차마다 단계가 따로 울린다",
        steps: [{ fire: "60min" }, { fire: "10min" }],
        sent: ["60min", "10min"],
      },
      {
        name: "시간대를 왕복해도 회차마다 한 번이다",
        steps: [
          { fire: "60min" },
          { travel: NEW_YORK },
          { fire: "60min" },
          { travel: SEOUL },
          { fire: "60min" },
        ],
        sent: ["60min"],
      },
    ])("$name", async ({ steps, sent }) => {
      // Given
      const ids = await seedOccurrences();
      // When
      for (const id of ids) {
        for (const step of steps) {
          if ("fire" in step) {
            await fireStage(id, step.fire);
          } else if ("travel" in step) {
            await client
              .update(userPreference)
              .set({ timezone: step.travel })
              .where(eq(userPreference.userId, userId));
            await rebase.execute({ userId });
          }
        }
      }
      // Then
      const results = await Promise.all(ids.map((id) => readSent(id)));
      expect(results.map((result) => result.sent)).toEqual(
        ids.map((_, index) => sent.map((stage) => `D${index} ${stage}`)),
      );
    });

    it("한 회차를 다른 회차의 날짜로 옮겨도 서로 막지 않는다", async () => {
      // Given
      const [first, second] = await seedOccurrences();
      await fireStage(first, "60min");
      await fireStage(second, "60min");
      // When
      await moveTo(first, 1, "10:00");
      await fireStage(first, "60min");
      // Then
      expect((await readSent(first)).sent).toEqual(["D0 60min", "D1 60min"]);
      expect((await readSent(second)).sent).toEqual(["D1 60min"]);
    });
  });

  it("같은 작업을 다시 처리하거나 동시에 처리해도 알림과 푸시는 하나다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    const job = {
      name: "send-reminder",
      data: { todoId: id, userId, stageLabel: "60min" },
    } as const;
    // When
    await Promise.all([processor.process(job), processor.process(job), processor.process(job)]);
    await processor.process(job);
    // Then
    expect(await readSent(id)).toEqual({ sent: ["D0 60min"], dispatches: 1 });
  });

  it("휴면 안내는 지금처럼 할 일마다 하나이고 단계 알림을 막지 않는다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    const paused = { name: "send-series-paused-notice", data: { todoId: id, userId } } as const;
    // When
    await processor.process(paused);
    await processor.process(paused);
    await fireStage(id, "60min");
    // Then
    expect((await readSent(id)).sent).toEqual(["D0 series-paused", "D0 60min"]);
  });

  it("알림 metadata는 앱이 받던 모양 그대로다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    // When
    await fireStage(id, "60min");
    // Then
    const row = await client.query.notification.findFirst({ where: { todoId: id } });
    expect(row?.metadata).toEqual({
      stage: "60min",
      todoOwnerId: userId,
      todoDate: dayKey(0),
      copyRevision: expect.any(String),
    });
  });

  it("옛 서버가 회차 없이 쓴 행끼리는 지금처럼 할 일과 단계로 막힌다", async () => {
    // Given
    const id = await seedTodo(0, "10:00");
    const insertLegacy = () =>
      client
        .insert(notification)
        .values({
          userId,
          type: "TODO_REMINDER",
          title: "t",
          body: "b",
          todoId: id,
          metadata: { stage: "60min" },
        })
        .onConflictDoNothing()
        .returning({ id: notification.id });
    // When
    const first = await insertLegacy();
    const second = await insertLegacy();
    await fireStage(id, "60min");
    // Then
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await client.$count(notification, eq(notification.todoId, id))).toBe(2);
  });

  describe("기존 알림 행 이관", () => {
    function readBackfill(): string {
      const directory = join(process.cwd(), "drizzle");
      const folder = readdirSync(directory).find((name) =>
        name.endsWith("_notification_reminder_occurrence"),
      );
      const statements = readFileSync(join(directory, folder ?? "", "migration.sql"), "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim());
      return statements.find((statement) => statement.includes('UPDATE "Notification"')) ?? "";
    }

    async function seedLegacyRow(todoId: number, metadata: object) {
      const [row] = await client
        .insert(notification)
        .values({ userId, type: "TODO_REMINDER", title: "t", body: "b", todoId, metadata })
        .returning();
      return row?.id ?? 0;
    }

    async function readKey(id: number) {
      const row = await client.query.notification.findFirst({ where: { id } });
      return row?.reminderOccurrenceKey;
    }

    it.each([
      {
        name: "지금 날짜로 울린 행은 지금 회차로 적는다",
        todoDate: 0,
        stage: "60min",
        expected: true,
      },
      { name: "다른 날짜로 울린 행은 비워 둔다", todoDate: 1, stage: "60min", expected: false },
      {
        name: "todoDate가 없는 옛 행은 비워 둔다",
        todoDate: null,
        stage: "60min",
        expected: false,
      },
      { name: "휴면 안내는 비워 둔다", todoDate: 0, stage: "series-paused", expected: false },
    ])("$name", async ({ todoDate, stage, expected }) => {
      // Given
      const id = await seedTodo(0, "10:00");
      const row = await seedLegacyRow(id, {
        stage,
        ...(todoDate == null ? {} : { todoDate: dayKey(todoDate) }),
      });
      // When
      await client.execute(sql.raw(readBackfill()));
      await client.execute(sql.raw(readBackfill()));
      // Then
      expect(await readKey(row)).toBe(expected ? `${dayKey(0)}T10:00` : null);
    });

    it("종일과 지난 할 일은 비워 둔다", async () => {
      // Given
      const allDay = await seedTodo(0, "10:00", {
        scheduledLocalTime: null,
        scheduledTime: null,
        isAllDay: true,
      });
      const pastDate = addDaysToDateKey(today, -10);
      const past = await seedTodo(0, "10:00", { startDate: Temporal.PlainDate.from(pastDate) });
      const allDayRow = await seedLegacyRow(allDay, { stage: "60min", todoDate: dayKey(0) });
      const pastRow = await seedLegacyRow(past, { stage: "60min", todoDate: pastDate });
      // When
      await client.execute(sql.raw(readBackfill()));
      // Then
      expect(await readKey(allDayRow)).toBeNull();
      expect(await readKey(pastRow)).toBeNull();
    });

    it("이관한 행의 단계는 다시 울리지 않고 남은 단계와 옮긴 날짜는 울린다", async () => {
      // Given
      const id = await seedTodo(0, "10:00");
      await seedLegacyRow(id, { stage: "60min", todoDate: dayKey(0) });
      await client.execute(sql.raw(readBackfill()));
      // When
      await travelTo(NEW_YORK);
      await fireStage(id, "60min");
      await fireStage(id, "10min");
      await moveTo(id, 1, "10:00");
      await fireStage(id, "60min");
      // Then
      expect((await readSent(id)).sent).toEqual(["D0 60min", "D0 10min", "D1 60min"]);
    });

    it("옮겨진 뒤 남은 옛 행은 새 날짜를 막지 않는다", async () => {
      // Given
      const id = await seedTodo(1, "10:00");
      await seedLegacyRow(id, { stage: "60min", todoDate: dayKey(0) });
      await client.execute(sql.raw(readBackfill()));
      // When
      await fireStage(id, "60min");
      // Then
      expect((await readSent(id)).sent).toEqual(["D0 60min", "D1 60min"]);
    });
  });
});
