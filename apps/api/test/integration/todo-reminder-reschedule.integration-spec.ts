import { PgBoss } from "pg-boss";
import { vi } from "vitest";

import {
  TODO_REMINDER_QUEUE,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_JOB_POLICY,
} from "#api/modules/notification/infrastructure/jobs/reminders/todo-reminder-queue.constants";
import { TodoReminderSchedulerAdapter } from "#api/modules/notification/infrastructure/jobs/reminders/todo-reminder-scheduler.adapter";
import { PgBossJobRuntimeAdapter } from "#api/platform/jobs/pg-boss-job-runtime.adapter";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";

import { suppressLogger } from "../setup/suppress-logger.js";
import { TestDatabase } from "../setup/test-database.js";

const SCHEMA = "pgboss";
const USER_ID = "user-reminder";
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("리마인더 재예약 (실제 pg-boss)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let runtime: PgBossJobRuntimeAdapter;
  let scheduler: TodoReminderSchedulerAdapter;
  let transaction: ReturnType<typeof createDatabaseTransactionFixture>;
  let nextTodoId = 1;

  const queuedStarts = async (todoId: number, label: string): Promise<number[]> => {
    const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, {
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
    runtime = new PgBossJobRuntimeAdapter(boss, transaction.txHost, {
      job: { shutdownTimeoutMs: 10_000 },
    });
    await runtime.start();
    scheduler = new TodoReminderSchedulerAdapter(runtime);
  });

  beforeEach(() => {
    suppressLogger();
    nextTodoId += 1;
  });

  afterAll(async () => {
    await runtime?.stop();
    await testDatabase?.stop();
  });

  it("단일 할 일의 시간을 바꾸면 새 시각의 작업만 대기한다", async () => {
    // Given
    const todoId = nextTodoId;
    const first = new Date(Date.now() + 5 * HOUR_MS);
    const moved = new Date(Date.now() + 8 * HOUR_MS);
    await scheduler.scheduleReminder(todoId, first, USER_ID);

    // When
    await scheduler.scheduleReminder(todoId, moved, USER_ID);

    // Then
    const starts = await queuedStarts(todoId, "60min");
    expect(starts).toHaveLength(1);
    expect(Math.abs((starts[0] ?? 0) - (moved.getTime() - HOUR_MS))).toBeLessThan(MINUTE_MS);
    await expect(queuedStarts(todoId, "10min")).resolves.toHaveLength(1);
  });

  it("범위 수정처럼 취소 뒤 일괄 등록해도 새 시각의 작업만 대기한다", async () => {
    // Given
    const todoIds = [nextTodoId, nextTodoId + 1000];
    const first = new Date(Date.now() + 5 * HOUR_MS);
    const moved = new Date(Date.now() + 8 * HOUR_MS);
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
      expect(Math.abs((starts[0] ?? 0) - (moved.getTime() - HOUR_MS))).toBeLessThan(MINUTE_MS);
    }
  });

  it("이미 끝난 단계 작업이 보존 중이어도 다시 예약할 수 있다", async () => {
    // Given
    const todoId = nextTodoId;
    const soon = new Date(Date.now() + 5 * MINUTE_MS);
    await scheduler.scheduleReminder(todoId, soon, USER_ID);
    const handled = vi.fn().mockResolvedValue(undefined);
    await runtime.work(TODO_REMINDER_QUEUE, handled, { teamSize: 1, pollingIntervalSeconds: 1 });
    await vi.waitFor(
      async () => {
        const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, {
          key: `reminder_${todoId}_immediate`,
        });
        expect(jobs[0]?.state).toBe("completed");
      },
      { timeout: 15_000, interval: 200 },
    );

    // When
    await scheduler.scheduleReminder(todoId, new Date(Date.now() + 8 * MINUTE_MS), USER_ID);

    // Then
    await vi.waitFor(
      () => {
        expect(handled.mock.calls.flat(2).length).toBeGreaterThanOrEqual(2);
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
    const options = {
      ...TODO_SERIES_PAUSED_JOB_POLICY,
      idempotencyKey: `series-paused_${USER_ID}_${nextTodoId}`,
    };
    const handled = vi.fn().mockResolvedValue(undefined);
    await runtime.work(TODO_REMINDER_QUEUE, handled, { teamSize: 1, pollingIntervalSeconds: 1 });
    await runtime.enqueue(TODO_REMINDER_QUEUE, job, options);
    await vi.waitFor(
      async () => {
        const jobs = await boss.findJobs(TODO_REMINDER_QUEUE, { key: options.idempotencyKey });
        expect(jobs[0]?.state).toBe("completed");
      },
      { timeout: 15_000, interval: 200 },
    );
    // When
    const again = await runtime.enqueue(TODO_REMINDER_QUEUE, job, options);
    // Then
    expect(again).toBeNull();
    const [kept] = await boss.findJobs(TODO_REMINDER_QUEUE, { key: options.idempotencyKey });
    expect(kept?.deleteAfterSeconds).toBe(TODO_SERIES_PAUSED_JOB_POLICY.deleteAfterSeconds);
  });

  it("트랜잭션이 되돌려지면 지운 작업이 그대로 남고 새 작업도 없다", async () => {
    // Given
    const todoId = nextTodoId;
    const first = new Date(Date.now() + 5 * HOUR_MS);
    await scheduler.scheduleReminder(todoId, first, USER_ID);
    const before = await queuedStarts(todoId, "60min");

    // When
    const outcome = transaction.uow.run(async () => {
      await scheduler.cancelReminders([todoId]);
      await scheduler.scheduleReminders([
        { todoId, scheduledTime: new Date(Date.now() + 8 * HOUR_MS), userId: USER_ID },
      ]);
      throw new Error("force rollback");
    });

    // Then
    await expect(outcome).rejects.toThrow("force rollback");
    await expect(queuedStarts(todoId, "60min")).resolves.toEqual(before);
  });
});
