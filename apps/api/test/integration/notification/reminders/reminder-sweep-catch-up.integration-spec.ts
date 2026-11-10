import { Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { omit } from "es-toolkit";
import { vi } from "vitest";

import { NotificationHistoryReader } from "#api/modules/notification/inbox/application/notification-history.reader";
import { DrizzleNotificationReader } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.reader";
import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { PersistBatchNotificationUseCase } from "#api/modules/notification/push/application/use-cases/persist-batch-notification.use-case";
import { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";
import { SendBatchNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-batch-notification.use-case";
import { SendNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-notification.use-case";
import { DrizzleNotificationTodoTargetReader } from "#api/modules/notification/push/infrastructure/persistence/drizzle-notification-todo-target.reader";
import { DrizzlePushDispatchStagingRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-dispatch-staging.repository";
import { NotificationRemindersLogEvent } from "#api/modules/notification/reminders/application/reminders.log-events";
import { SendMorningReminderUseCase } from "#api/modules/notification/reminders/application/use-cases/send-morning-reminder.use-case";
import {
  SweepTimezoneRemindersUseCase,
  TIMEZONE_REMINDER_SWEEP_CURSOR_KEY,
} from "#api/modules/notification/reminders/application/use-cases/sweep-timezone-reminders.use-case";
import type { TimezoneContext } from "#api/modules/notification/reminders/domain/timezone-context.read-model";
import { TodoReminderQueueProcessor } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-queue.processor";
import { DrizzleSchedulerReader } from "#api/modules/notification/reminders/infrastructure/persistence/drizzle-scheduler.reader";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  notification,
  todo,
  todoCategory,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { DrizzleSweepCursorAdapter } from "#api/platform/jobs/drizzle-sweep-cursor.adapter";
import { SweepCursorPort } from "#api/shared/application/ports/sweep-cursor.port";
import { StubNotificationRecipientLocaleReader } from "#test/doubles/notification/stub-notification-recipient-locale.reader";
import { StubTodoSeriesOwnerDormancy } from "#test/doubles/notification/stub-todo-series-owner-dormancy";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SEOUL = "Asia/Seoul";
/** 서울 2026-11-10 07:56. 무료 아침 리마인더는 08:00에 울린다 */
const BEFORE_MORNING = Temporal.Instant.from("2026-11-09T22:56:00Z");

// 한 번만 커서 기록을 실패시켜 "분을 처리한 뒤 커서를 쓰기 전에 멈춘" worker를 흉내 낸다
class InterruptibleSweepCursor extends SweepCursorPort {
  readonly #inner: SweepCursorPort;
  failNextMark = false;

  constructor(inner: SweepCursorPort) {
    super();
    this.#inner = inner;
  }

  findLastCompletedAt(key: string): Promise<Temporal.Instant | null> {
    return this.#inner.findLastCompletedAt(key);
  }

  async markCompleted(key: string, at: Temporal.Instant): Promise<void> {
    if (this.failNextMark) {
      this.failNextMark = false;
      throw new Error("worker stopped before cursor write");
    }
    await this.#inner.markCompleted(key, at);
  }
}

// 나머지 전략은 이 시나리오의 대상이 아니라 호출만 받는다
const idleStrategy = { execute: async () => ({ sent: 0 }) };

describe("리마인더 sweep 따라잡기 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let transaction: ReturnType<typeof createDatabaseTransactionFixture>;
  let reader: DrizzleSchedulerReader;
  let publisher: PublishNotificationUseCase;
  let userId: string;

  beforeAll(async () => {
    client = await database.start();
    transaction = createDatabaseTransactionFixture(client);
    const { txHost, uow } = transaction;
    reader = new DrizzleSchedulerReader(
      txHost,
      new CacheService(new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 10 })),
      { onboardingV2: { enabled: false, treatmentPercent: 50 } },
      new DateClock(),
    );
    publisher = new PublishNotificationUseCase({
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
  });

  beforeEach(async () => {
    suppressLogger();
    await database.cleanup();
    const user = UserFixture.create({
      id: createEntityId(),
      email: "catch-up@example.com",
      userTag: "CATCHUP1",
    });
    await client.insert(userTable).values(user);
    await client.insert(userPreference).values({ userId: user.id, timezone: SEOUL });
    userId = user.id;
  });

  afterAll(async () => {
    await database.stop();
  });

  function createWorker(now: Temporal.Instant) {
    const clock = new FixedClock(now);
    const cursor = new InterruptibleSweepCursor(new DrizzleSweepCursorAdapter(transaction.txHost));
    const logger = new SilentLogger();
    const sweptMinutes: string[] = [];
    const morningReminder = new SendMorningReminderUseCase({
      reader,
      notificationPublisher: publisher,
      // Redis가 비어 있는(cold) 상태로 두어 저장된 알림 행만으로 하루 한 번을 판단하게 한다
      notificationHistoryReader: new NotificationHistoryReader({
        notificationDedup: {
          readKnownRecipients: async () => null,
          warmRecipients: async () => undefined,
        },
        notificationHistoryReader: new DrizzleNotificationReader(transaction.txHost),
        logger: new SilentLogger(),
      }),
      logger: new SilentLogger(),
    });
    const sweep = new SweepTimezoneRemindersUseCase({
      preferenceReader: reader,
      enqueuer: { enqueueSocialDigest: () => undefined },
      sweepCursor: cursor,
      clock,
      morningReminder: {
        execute: async (context: TimezoneContext) => {
          sweptMinutes.push(`${context.localHour}:${String(context.localMinute).padStart(2, "0")}`);
          return morningReminder.execute(context);
        },
      },
      eveningReminder: { execute: async () => ({ sent: 0, recipientUserIds: [] }) },
      weeklyReport: idleStrategy,
      monthlyReport: idleStrategy,
      weeklyAchievement: idleStrategy,
      winback: idleStrategy,
      nudgeSuggest: idleStrategy,
      socialDigest: idleStrategy,
      lunchNudge: idleStrategy,
      streakAtRisk: idleStrategy,
      onboarding: idleStrategy,
      weatherMorning: idleStrategy,
      weatherEvening: idleStrategy,
      logger,
      alert: { raise: () => undefined },
    });
    return { clock, cursor, logger, sweptMinutes, sweep };
  }

  async function morningReminders() {
    return client
      .select({ notificationDate: notification.notificationDate })
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.type, "MORNING_REMINDER")));
  }

  describe("worker 정지 → 시각 경과 → 재시작", () => {
    it("멈춘 사이의 분을 순서대로 한 번씩 처리해 놓친 아침 리마인더를 한 번 보낸다", async () => {
      // Given: 07:56에 돌고 worker가 멈춘다
      const worker = createWorker(BEFORE_MORNING);
      await worker.sweep.handleMinuteSweep();
      expect(worker.sweptMinutes).toEqual(["7:56"]);

      // When: 08:01에 다시 시작한다
      worker.clock.advanceBy({ minutes: 5 });
      await worker.sweep.handleMinuteSweep();

      // Then
      expect(worker.sweptMinutes).toEqual(["7:56", "7:57", "7:58", "7:59", "8:00", "8:01"]);
      expect(await morningReminders()).toEqual([
        { notificationDate: Temporal.PlainDate.from("2026-11-10") },
      ]);
      expect(await worker.cursor.findLastCompletedAt(TIMEZONE_REMINDER_SWEEP_CURSOR_KEY)).toEqual(
        BEFORE_MORNING.add({ minutes: 5 }),
      );
    });

    it("같은 시각에 다시 돌면 새로 처리하는 분이 없어 다시 보내지 않는다", async () => {
      // Given
      const worker = createWorker(BEFORE_MORNING);
      await worker.sweep.handleMinuteSweep();
      worker.clock.advanceBy({ minutes: 5 });
      await worker.sweep.handleMinuteSweep();

      // When
      await worker.sweep.handleMinuteSweep();

      // Then
      expect(worker.sweptMinutes).toEqual(["7:56", "7:57", "7:58", "7:59", "8:00", "8:01"]);
      expect(await morningReminders()).toHaveLength(1);
    });

    it("커서를 쓰기 전에 멈춰 같은 분을 두 번 처리해도 아침 리마인더는 하나다", async () => {
      // Given: 07:59까지 끝냈고, 08:00을 보낸 뒤 커서를 쓰기 전에 멈춘다
      const worker = createWorker(BEFORE_MORNING.add({ minutes: 3 }));
      await worker.sweep.handleMinuteSweep();
      worker.clock.advanceBy({ minutes: 1 });
      worker.cursor.failNextMark = true;
      await worker.sweep.handleMinuteSweep();

      // When: 재시작한 worker가 08:00부터 다시 처리한다
      worker.clock.advanceBy({ minutes: 1 });
      await worker.sweep.handleMinuteSweep();

      // Then
      expect(worker.sweptMinutes).toEqual(["7:59", "8:00", "8:00", "8:01"]);
      expect(await morningReminders()).toHaveLength(1);
    });

    it("15분 넘게 멈추면 마지막 15분만 처리하고 버린 분 수를 사유와 함께 남긴다", async () => {
      // Given: 07:40에 돌고 40분 동안 멈춘다. 08:00은 버리는 구간에 있다
      const worker = createWorker(BEFORE_MORNING.subtract({ minutes: 16 }));
      await worker.sweep.handleMinuteSweep();

      // When
      worker.clock.advanceBy({ minutes: 40 });
      await worker.sweep.handleMinuteSweep();

      // Then
      const caughtUp = worker.sweptMinutes.slice(1);
      expect(caughtUp).toEqual(
        Array.from({ length: 15 }, (_, index) => `8:${String(6 + index).padStart(2, "0")}`),
      );
      expect(worker.logger.messages).toContainEqual({
        event: NotificationRemindersLogEvent.TIMEZONE_AWARE_REMINDER_MINUTES_SKIPPED,
        reason: "late-over-15m",
        skippedMinutes: 25,
      });
      expect(await morningReminders()).toEqual([]);
    });

    describe("할 일 리마인더 작업", () => {
      async function seedTodo(scheduledAt: Temporal.Instant): Promise<number> {
        const [category] = await client
          .insert(todoCategory)
          .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
          .returning();
        const [row] = await client
          .insert(todo)
          .values({
            ...omit(TodoFixture.create({ userId, categoryId: category?.id ?? 0 }), ["id"]),
            startDate: Temporal.PlainDate.from("2026-11-10"),
            scheduledLocalTime: "09:00",
            scheduledTime: scheduledAt,
            isAllDay: false,
            completed: false,
          })
          .returning();
        return row?.id ?? 0;
      }

      function createProcessor(now: Temporal.Instant) {
        return new TodoReminderQueueProcessor(
          reader,
          new StubTodoSeriesOwnerDormancy(),
          publisher,
          new StubNotificationRecipientLocaleReader(),
          new InMemoryJobQueue(),
          new FixedClock(now),
          { raise: () => undefined },
        );
      }

      async function todoReminders(todoId: number) {
        return client.select().from(notification).where(eq(notification.todoId, todoId));
      }

      // 서울 09:00 할 일의 60분 단계는 08:00(UTC 23:00)에 울려야 했다
      const NINE_AM = Temporal.Instant.from("2026-11-10T00:00:00Z");
      const job = (todoId: number) =>
        ({
          name: "send-reminder",
          data: { todoId, userId, stageLabel: "60min" },
        }) as const;

      it("울려야 했던 시각보다 15분 넘게 늦게 꺼낸 작업은 보내지 않고 사유를 남긴다", async () => {
        // Given: 배포로 16분 늦게 꺼냈다
        const todoId = await seedTodo(NINE_AM);
        const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

        // When
        await createProcessor(NINE_AM.subtract({ minutes: 44 })).process(job(todoId));

        // Then
        expect(await todoReminders(todoId)).toEqual([]);
        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({
            event: NotificationRemindersLogEvent.TODO_REMINDER_LATE_SKIPPED,
            reason: "late-over-15m",
            lateMinutes: 16,
          }),
        );
      });

      it("15분 안으로 늦은 작업은 보내고 같은 작업을 다시 처리해도 알림은 하나다", async () => {
        // Given: 10분 늦게 꺼냈다
        const todoId = await seedTodo(NINE_AM);
        const processor = createProcessor(NINE_AM.subtract({ minutes: 50 }));

        // When
        await processor.process(job(todoId));
        await processor.process(job(todoId));

        // Then
        expect(await todoReminders(todoId)).toHaveLength(1);
      });
    });
  });
});
