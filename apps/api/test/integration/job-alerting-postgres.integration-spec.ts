import { sql } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { z } from "zod";

import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { JobAlerts } from "#api/platform/jobs/jobs.alerts";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { PgBossScheduleRunReader } from "#api/platform/jobs/pg-boss-schedule-run.reader";
import { ScheduleWatchdogProcessor } from "#api/platform/jobs/schedule-watchdog.processor";
import { SCHEDULE_WATCHDOG_HEARTBEAT } from "#api/platform/jobs/schedule-watchdog.queue";
import { DeduplicatingOperationalAlertAdapter } from "#api/platform/observability/deduplicating-operational-alert.adapter";
import {
  defineQueue,
  type JobRetryPolicy,
  type OperationalAlertPort,
  type QueueDefinition,
} from "#api/shared/application/ports/index";
import { alertIssueKey } from "#api/shared/application/ports/operational-alert.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingJobHeartbeat } from "#test/doubles/platform/recording-job-heartbeat";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const SCHEMA = "pgboss";

const RETRY: JobRetryPolicy = {
  retryLimit: 1,
  retryDelaySeconds: 0,
  retryBackoff: false,
  expireInSeconds: 30,
  retentionSeconds: 14 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
};

const documentSchema = z.object({ documentId: z.number().int() });

class DocumentRenderError extends Error {
  override name = "DocumentRenderError";
}

function documentQueue(
  name: string,
  overrides: Partial<QueueDefinition<z.infer<typeof documentSchema>>> = {},
): QueueDefinition<z.infer<typeof documentSchema>> {
  return defineQueue({
    name,
    payloadSchema: documentSchema,
    retry: RETRY,
    worker: { localConcurrency: 1, pollingIntervalSeconds: 0.5 },
    ...overrides,
  });
}

function hourlyQueue(name: string, scheduleKey: string): QueueDefinition<object> {
  return defineQueue({
    name,
    payloadSchema: z.strictObject({}),
    retry: { ...RETRY, retryLimit: 0 },
    worker: { localConcurrency: 1, pollingIntervalSeconds: 0.5 },
    schedules: [
      { key: scheduleKey, cron: "0 * * * *", timezone: "UTC", missed: "skip", payload: {} },
    ],
  });
}

async function eventually(assertion: () => Promise<void> | void, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

describe("작업 실패 경보 통합 테스트 (실제 PostgreSQL·pg-boss)", () => {
  let testDatabase: TestDatabase;
  let database: TestDatabaseClient;
  let boss: PgBoss;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    database = await testDatabase.start();
    const connectionString = testDatabase.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });

    // 테스트 중 pg-boss cron이 스케줄 실행을 만들어 창 안 실행 수를 바꾸지 않게 한다
    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
      schedule: false,
    });
    await boss.start();
  });

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    await testDatabase?.stop();
  });

  function jobQueueWith(alerts: OperationalAlertPort, registry = new JobQueueRegistry()) {
    const { txHost } = createDatabaseTransactionFixture(database);
    return new PgBossJobQueueAdapter(boss, txHost, registry, { shutdownTimeoutMs: 10_000 }, alerts);
  }

  function watchdogWith(alerts: OperationalAlertPort, registry = new JobQueueRegistry()) {
    const heartbeat = new RecordingJobHeartbeat();
    const reader = new PgBossScheduleRunReader(boss, database, { schema: SCHEMA });
    const watchdog = new ScheduleWatchdogProcessor(
      jobQueueWith(alerts, registry),
      reader,
      registry,
      alerts,
      heartbeat,
      new FixedClock(Temporal.Now.instant()),
    );
    return { watchdog, heartbeat };
  }

  async function registerLongAgo(queue: QueueDefinition<object>): Promise<void> {
    await jobQueueWith(new RecordingOperationalAlert()).registerSchedules(queue);
    await database.execute(sql`
      UPDATE pgboss.schedule SET created_on = now() - interval '1 day' WHERE name = ${queue.name}
    `);
  }

  async function jobStates(queue: string): Promise<string[]> {
    const jobs = await boss.findJobs(queue);
    return jobs.map(({ state }) => state);
  }

  it("재시도가 남은 실패는 경보하지 않고 재시도를 다 쓴 실패만 경보한다", async () => {
    // Given
    const alerts = new RecordingOperationalAlert();
    const queue = documentQueue("integration-alert-final-only", {
      retry: { ...RETRY, retryLimit: 2 },
    });
    const jobQueue = jobQueueWith(alerts);
    let attempts = 0;
    await jobQueue.enqueue(queue, { documentId: 1 });

    // When
    await jobQueue.work(queue, async () => {
      attempts += 1;
      throw new DocumentRenderError("provider rejected document 1 for user@example.com");
    });

    // Then
    await eventually(async () => {
      expect(await jobStates(queue.name)).toEqual(["failed"]);
    });
    expect(attempts).toBe(3);
    expect(alerts.alerts).toEqual([
      {
        ...JobAlerts.FAILED,
        subject: "integration-alert-final-only:DocumentRenderError",
        tags: {
          queue: "integration-alert-final-only",
          "job.name": "integration-alert-final-only",
          "job.attempt": "3",
          "error.type": "DocumentRenderError",
        },
        details: { retryLimit: 2 },
      },
    ]);
  });

  it("늘 실패하는 작업은 재시도를 다 써도 같은 원인 경보가 반복 간격마다 한 번만 올라간다", async () => {
    // Given
    const recorded = new RecordingOperationalAlert();
    const clock = new FixedClock(Temporal.Now.instant());
    const queue = documentQueue("integration-alert-dedup");
    const jobQueue = jobQueueWith(new DeduplicatingOperationalAlertAdapter(recorded, clock));
    await jobQueue.work(queue, async () => {
      throw new DocumentRenderError("render failed");
    });

    // When
    await jobQueue.enqueue(queue, { documentId: 1 });
    await jobQueue.enqueue(queue, { documentId: 2 });
    await eventually(async () => {
      expect(await jobStates(queue.name)).toEqual(["failed", "failed"]);
    });
    const raisedWithinWindow = recorded.alerts.length;
    clock.advanceBy({ hours: 1 });
    await jobQueue.enqueue(queue, { documentId: 3 });
    await eventually(async () => {
      expect(await jobStates(queue.name)).toEqual(["failed", "failed", "failed"]);
    });

    // Then
    expect(raisedWithinWindow).toBe(1);
    expect(recorded.alerts.map(alertIssueKey)).toEqual([
      "job.failed:integration-alert-dedup:DocumentRenderError",
      "job.failed:integration-alert-dedup:DocumentRenderError",
    ]);
  });

  it("두 번의 예정 시각이 지나도록 끝난 실행이 없는 스케줄은 overdue로 경보하고 생존 신호를 보낸다", async () => {
    // Given
    const alerts = new RecordingOperationalAlert();
    await registerLongAgo(hourlyQueue("integration-watch-overdue", "integration-hourly-overdue"));
    const { watchdog, heartbeat } = watchdogWith(alerts);

    // When
    await watchdog.run();

    // Then
    expect(alerts.alerts.map(alertIssueKey)).toContain(
      "schedule.overdue:integration-hourly-overdue",
    );
    expect(heartbeat.schedules).toEqual([SCHEDULE_WATCHDOG_HEARTBEAT]);
    expect(heartbeat.succeeded).toBe(1);
  });

  it("최근 실행이 끝난 스케줄은 경보하지 않는다", async () => {
    // Given
    const alerts = new RecordingOperationalAlert();
    const queue = hourlyQueue("integration-watch-healthy", "integration-hourly-healthy");
    await registerLongAgo(queue);
    const jobQueue = jobQueueWith(new RecordingOperationalAlert());
    await jobQueue.work(queue, async () => {});
    await jobQueue.enqueue(queue, {});
    await eventually(async () => {
      expect(await jobStates(queue.name)).toEqual(["completed"]);
    });
    const { watchdog } = watchdogWith(alerts);

    // When
    await watchdog.run();

    // Then
    const keys = alerts.alerts.map(alertIssueKey);
    expect(keys).not.toContain("schedule.overdue:integration-hourly-healthy");
    expect(keys).not.toContain("schedule.failing:integration-hourly-healthy");
  });

  it("최근 실행이 모두 실패한 스케줄은 failing으로 경보한다", async () => {
    // Given
    const alerts = new RecordingOperationalAlert();
    const queue = hourlyQueue("integration-watch-failing", "integration-hourly-failing");
    await registerLongAgo(queue);
    const jobQueue = jobQueueWith(new RecordingOperationalAlert());
    await jobQueue.work(queue, async () => {
      throw new DocumentRenderError("dispatch failed");
    });
    await jobQueue.enqueue(queue, {});
    await eventually(async () => {
      expect(await jobStates(queue.name)).toEqual(["failed"]);
    });
    const { watchdog } = watchdogWith(alerts);

    // When
    await watchdog.run();

    // Then
    expect(alerts.alerts).toContainEqual(
      expect.objectContaining({
        key: "schedule.failing",
        subject: "integration-hourly-failing",
        details: expect.objectContaining({ failedRuns: 1 }),
      }),
    );
  });

  it("최근 감시 주기 안에 DLQ로 옮겨진 작업이 있으면 DLQ 경보를 올린다", async () => {
    // Given
    const alerts = new RecordingOperationalAlert();
    const registry = new JobQueueRegistry();
    const queue = documentQueue("integration-watch-source", {
      retry: { ...RETRY, retryLimit: 0 },
      deadLetter: {
        queue: "integration-watch-source-dead-letter",
        jobPolicy: { ...RETRY, retryLimit: 0 },
      },
    });
    const jobQueue = jobQueueWith(new RecordingOperationalAlert(), registry);
    await jobQueue.work(queue, async () => {
      throw new DocumentRenderError("delivery failed");
    });
    await jobQueue.enqueue(queue, { documentId: 7 });
    await eventually(async () => {
      expect(await jobStates("integration-watch-source-dead-letter")).toHaveLength(1);
    });
    const { watchdog } = watchdogWith(alerts, registry);

    // When
    await watchdog.run();

    // Then
    expect(alerts.alerts).toContainEqual(
      expect.objectContaining({
        key: "queue.dead-letter",
        subject: "integration-watch-source-dead-letter",
        details: { arrivals: 1, windowMinutes: 15 },
      }),
    );
  });
});
