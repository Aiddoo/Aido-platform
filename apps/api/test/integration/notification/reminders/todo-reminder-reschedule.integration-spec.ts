import { PgBoss } from "pg-boss";
import { vi } from "vitest";

import { TodoReminderSchedulerAdapter } from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder-scheduler.adapter";
import {
  TODO_REMINDER_QUEUE,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_QUEUE,
} from "#api/modules/notification/reminders/infrastructure/jobs/todo-reminder.queue";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { DateClock } from "#test/doubles/platform/date-clock";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase } from "#test/setup/test-database";

import { withFastJobTiming } from "../../helpers/fast-job-timing.js";

const SCHEMA = "pgboss";
const USER_ID = "user-reminder";
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const FAST_TODO_REMINDER_QUEUE = withFastJobTiming(TODO_REMINDER_QUEUE);

describe("리마인더 재예약 (실제 pg-boss)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let scheduler: TodoReminderSchedulerAdapter;
  let transaction: ReturnType<typeof createDatabaseTransactionFixture>;
  let nextTodoId = 1;

  const queuedStarts = async (todoId: number, label: string): Promise<number[]> => {
    const jobs = await boss.findJobs(TODO_REMINDER_QUEUE.name, {
      key: `reminder_${todoId}_${label}`,
      queued: true,
    });
    return jobs.map((job) => job.startAfter.getTime());
  };

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    const client = await testDatabase.start();
    const connectionString = testDatabase.getConnectionUri();
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
    scheduler = new TodoReminderSchedulerAdapter(jobQueue, new DateClock());
  });

  beforeEach(() => {
    suppressLogger();
    nextTodoId += 1;
  });

  afterAll(async () => {
    await jobQueue?.stop();
    await testDatabase?.stop();
  });

  it("단일 할 일의 시간을 바꾸면 새 시각의 작업만 대기한다", async () => {
    // Given
    const todoId = nextTodoId;
    const first = nowInstant().add({ milliseconds: 5 * HOUR_MS });
    const moved = nowInstant().add({ milliseconds: 8 * HOUR_MS });
    await scheduler.scheduleReminder(todoId, first, USER_ID);

    // When
    await scheduler.scheduleReminder(todoId, moved, USER_ID);

    // Then
    const starts = await queuedStarts(todoId, "60min");
    expect(starts).toHaveLength(1);
    expect(Math.abs((starts[0] ?? 0) - (moved.epochMilliseconds - HOUR_MS))).toBeLessThan(
      MINUTE_MS,
    );
    await expect(queuedStarts(todoId, "10min")).resolves.toHaveLength(1);
  });

  it("범위 수정처럼 취소 뒤 일괄 등록해도 새 시각의 작업만 대기한다", async () => {
    // Given
    const todoIds = [nextTodoId, nextTodoId + 1000];
    const first = nowInstant().add({ milliseconds: 5 * HOUR_MS });
    const moved = nowInstant().add({ milliseconds: 8 * HOUR_MS });
    await scheduler.scheduleReminders(
      todoIds.map((todoId) => ({ todoId, scheduledTime: first, userId: USER_ID })),
    );

    // When
    await scheduler.cancelReminders(todoIds);
    await scheduler.scheduleReminders(
      todoIds.map((todoId) => ({ todoId, scheduledTime: moved, userId: USER_ID })),
    );

    // Then
    for (const todoId of todoIds) {
      const starts = await queuedStarts(todoId, "60min");
      expect(starts).toHaveLength(1);
      expect(Math.abs((starts[0] ?? 0) - (moved.epochMilliseconds - HOUR_MS))).toBeLessThan(
        MINUTE_MS,
      );
    }
  });

  it("이미 끝난 단계 작업이 보존 중이어도 다시 예약할 수 있다", async () => {
    // Given
    const todoId = nextTodoId;
    const key = `reminder_${todoId}_10min`;
    await scheduler.scheduleReminder(
      todoId,
      nowInstant().add({ milliseconds: 10 * MINUTE_MS + 500 }),
      USER_ID,
    );
    await jobQueue.work(FAST_TODO_REMINDER_QUEUE, vi.fn().mockResolvedValue(undefined));
    const finished = await vi.waitFor(
      async () => {
        const [job] = await boss.findJobs(TODO_REMINDER_QUEUE.name, { key });
        expect(job?.state).toBe("completed");
        return job;
      },
      { timeout: 15_000, interval: 200 },
    );
    // When
    await scheduler.scheduleReminder(
      todoId,
      nowInstant().add({ milliseconds: 10 * MINUTE_MS + 500 }),
      USER_ID,
    );
    // Then
    await vi.waitFor(
      async () => {
        const [job] = await boss.findJobs(TODO_REMINDER_QUEUE.name, { key });
        expect(job?.createdOn.getTime()).toBeGreaterThan(finished?.createdOn.getTime() ?? 0);
        expect(job?.state).toBe("completed");
      },
      { timeout: 15_000, interval: 200 },
    );
  });

  it("휴면 안내는 끝난 뒤에도 행이 남아 같은 기간에 다시 등록되지 않는다", async () => {
    // Given
    const job = {
      name: TODO_SERIES_PAUSED_JOB_NAME,
      data: { todoId: nextTodoId, userId: USER_ID },
    };
    const options = { idempotencyKey: `series-paused_${USER_ID}_${nextTodoId}` };
    await jobQueue.work(FAST_TODO_REMINDER_QUEUE, vi.fn().mockResolvedValue(undefined));
    await jobQueue.enqueue(TODO_SERIES_PAUSED_QUEUE, job, options);
    await vi.waitFor(
      async () => {
        const jobs = await boss.findJobs(TODO_REMINDER_QUEUE.name, {
          key: options.idempotencyKey,
        });
        expect(jobs[0]?.state).toBe("completed");
      },
      { timeout: 15_000, interval: 200 },
    );
    // When
    const again = await jobQueue.enqueue(TODO_SERIES_PAUSED_QUEUE, job, options);
    // Then
    expect(again).toBeNull();
    const [kept] = await boss.findJobs(TODO_REMINDER_QUEUE.name, { key: options.idempotencyKey });
    expect(kept?.deleteAfterSeconds).toBe(120 * 24 * 60 * 60);
  });

  it("트랜잭션이 되돌려지면 지운 작업이 그대로 남고 새 작업도 없다", async () => {
    // Given
    const todoId = nextTodoId;
    const first = nowInstant().add({ milliseconds: 5 * HOUR_MS });
    await scheduler.scheduleReminder(todoId, first, USER_ID);
    const before = await queuedStarts(todoId, "60min");

    // When
    const outcome = transaction.uow.run(async () => {
      await scheduler.cancelReminders([todoId]);
      await scheduler.scheduleReminders([
        { todoId, scheduledTime: nowInstant().add({ milliseconds: 8 * HOUR_MS }), userId: USER_ID },
      ]);
      throw new Error("force rollback");
    });

    // Then
    await expect(outcome).rejects.toThrow("force rollback");
    await expect(queuedStarts(todoId, "60min")).resolves.toEqual(before);
  });
});
