import { Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { omit } from "es-toolkit";
import { PgBoss } from "pg-boss";
import { vi } from "vitest";

import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { PersistBatchNotificationUseCase } from "#api/modules/notification/push/application/use-cases/persist-batch-notification.use-case";
import { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";
import { SendBatchNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-batch-notification.use-case";
import { SendNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-notification.use-case";
import { todoReminderJobKey } from "#api/modules/notification/push/infrastructure/jobs/notification-job-keys.constants";
import { DrizzleNotificationTodoTargetReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-notification-todo-target.reader";
import { DrizzlePushDispatchStagingRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-dispatch-staging.repository";
import { NotificationRemindersLogEvent } from "#api/modules/notification/reminders/application/reminders.log-events";
import { TodoReminderQueueProcessor } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-queue.processor";
import {
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_QUEUE,
  type TodoReminderRuntimeJob,
} from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder.queue";
import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import {
  notification,
  todo,
  todoCategory,
  user as userTable,
} from "#api/platform/database/schema/index";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { StubNotificationRecipientLocaleReader } from "#test/doubles/notification/stub-notification-recipient-locale.reader";
import { StubTodoSeriesOwnerDormancy } from "#test/doubles/notification/stub-todo-series-owner-dormancy";
import { DateClock } from "#test/doubles/platform/date-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SCHEMA = "pgboss_todo_reminder_throughput";
const REMINDER_COUNT = 200;
const ALREADY_SENT_COUNT = 20;
// 폴링 직후에 때가 된 작업은 다음 폴링(한 간격)에 꺼내므로, 꺼낸 뒤 한 간격 안에 모두 끝나야 두 간격 안에 닿는다
const DRAIN_BOUND_MS = TODO_REMINDER_QUEUE.worker.pollingIntervalSeconds * 1000;

describe("할 일 리마인더 처리량 (실제 PostgreSQL + pg-boss)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let processor: TodoReminderQueueProcessor;
  let userId: string;

  beforeAll(async () => {
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });

    // 운영과 같은 pg-boss 풀(3)과 LISTEN/NOTIFY 없는 폴링이다
    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
      useListenNotify: false,
    });
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    jobQueue = new PgBossJobQueueAdapter(boss, txHost, new JobQueueRegistry(), {
      shutdownTimeoutMs: 10_000,
      workerEnabled: true,
    });
    await jobQueue.start();

    const publisher = new PublishNotificationUseCase({
      sendNotification: new SendNotificationUseCase({
        notificationRepository: new DrizzleNotificationRepository(txHost),
        pushDispatchStaging: new DrizzlePushDispatchStagingRepository(txHost, new DateClock()),
        cache: { invalidateUnreadCount: async () => undefined },
        unitOfWork: uow,
        afterCommit: { register: () => undefined },
        afterCommitPublisher: { register: () => undefined },
        logger: new SilentLogger(),
      }),
      sendNotificationWithDeduplication: { execute: async () => null },
      sendBatchNotification: new SendBatchNotificationUseCase({
        persistBatchNotificationUseCase: new PersistBatchNotificationUseCase({
          notificationRepository: new DrizzleNotificationRepository(txHost),
          pushDispatchStaging: new DrizzlePushDispatchStagingRepository(txHost, new DateClock()),
          unitOfWork: uow,
          afterCommitPublisher: { register: () => undefined },
        }),
        finalizeBatchNotificationUseCase: { execute: async () => ({ count: 0 }) },
        unitOfWork: uow,
        afterCommitTasks: { register: () => undefined },
      }),
      todoTargetReader: new DrizzleNotificationTodoTargetReader(txHost),
    });
    processor = new TodoReminderQueueProcessor(
      new DrizzleSchedulerReader(
        txHost,
        new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 }),
        { onboardingV2: { enabled: false, treatmentPercent: 50 } },
        new DateClock(),
      ),
      new StubTodoSeriesOwnerDormancy(),
      publisher,
      new StubNotificationRecipientLocaleReader(),
      jobQueue,
      new DateClock(),
      { raise: () => undefined },
    );

    const user = UserFixture.create({
      id: createEntityId(),
      email: "reminder-throughput@example.com",
      userTag: "THRUPUT1",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  }, 60_000);

  beforeEach(() => {
    suppressLogger();
  });

  afterAll(async () => {
    await jobQueue?.stop();
    await database.stop();
  });

  async function seedTodos(scheduledAt: Temporal.Instant): Promise<number[]> {
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    const startDate = scheduledAt.toZonedDateTimeISO("UTC").toPlainDate();
    const rows = await client
      .insert(todo)
      .values(
        Array.from({ length: REMINDER_COUNT }, (_, index) => ({
          ...omit(TodoFixture.create({ userId, categoryId: category?.id ?? 0 }), ["id"]),
          title: `throughput-${index}`,
          startDate,
          scheduledLocalTime: scheduledAt.toZonedDateTimeISO("UTC").toPlainTime().toString({
            smallestUnit: "minute",
          }),
          scheduledTime: scheduledAt,
          isAllDay: false,
          completed: false,
        })),
      )
      .returning({ id: todo.id });
    return rows.map(({ id }) => id);
  }

  const tenMinuteStage = (todoId: number): TodoReminderRuntimeJob => ({
    name: TODO_REMINDER_JOB_NAME,
    data: { todoId, userId, stageLabel: "10min" },
  });

  async function completedJobCount(): Promise<number> {
    const jobs = await boss.findJobs(TODO_REMINDER_QUEUE.name, { limit: REMINDER_COUNT * 2 });
    return jobs.filter((job) => job.state === "completed").length;
  }

  async function sentReminderCount(): Promise<number> {
    const rows = await client
      .select({ todoId: notification.todoId })
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.type, "TODO_REMINDER")));
    return rows.length;
  }

  it("같은 분에 때가 된 리마인더 200건을 폴링 한 간격 안에 모두 보내거나 중복으로 건너뛴다", async () => {
    // Given: 10분 뒤 시작하는 할 일 200개의 10분 단계가 지금 울려야 하고, 20개는 이미 울렸다
    const now = new DateClock().now();
    const todoIds = await seedTodos(now.add({ minutes: 10 }));
    for (const todoId of todoIds.slice(0, ALREADY_SENT_COUNT)) {
      await processor.process(tenMinuteStage(todoId));
    }
    await jobQueue.enqueueMany(
      TODO_REMINDER_QUEUE,
      todoIds.map((todoId) => ({
        payload: tenMinuteStage(todoId),
        idempotencyKey: todoReminderJobKey(todoId, "10min"),
        startAfter: now,
      })),
    );
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    // When
    const startedAt = performance.now();
    await processor.onModuleInit();
    await vi.waitFor(
      async () => {
        expect(await completedJobCount()).toBe(REMINDER_COUNT);
      },
      { timeout: DRAIN_BOUND_MS, interval: 100 },
    );
    const elapsedMs = performance.now() - startedAt;

    // Then
    expect(elapsedMs).toBeLessThan(DRAIN_BOUND_MS);
    expect(await sentReminderCount()).toBe(REMINDER_COUNT);
    expect(warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: NotificationRemindersLogEvent.TODO_REMINDER_LATE_SKIPPED }),
    );
  }, 60_000);
});
