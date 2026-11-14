import { sql } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { vi } from "vitest";
import { z } from "zod";

import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import {
  defineQueue,
  type JobRetryPolicy,
  type QueueDefinition,
} from "#api/shared/application/ports/job-queue.port";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";

import { TestDatabase } from "../setup/test-database.js";
import { FAST_JOB_POLLING_SECONDS, WORKER_WAIT } from "./helpers/fast-job-timing.js";

const SCHEMA = "pgboss";

const RETRY: JobRetryPolicy = {
  retryLimit: 1,
  retryDelaySeconds: 1,
  retryBackoff: false,
  expireInSeconds: 30,
  retentionSeconds: 14 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
};

const documentSchema = z.object({ documentId: z.number().int() });
type DocumentPayload = z.infer<typeof documentSchema>;

function documentQueue(
  name: string,
  overrides: Partial<QueueDefinition<DocumentPayload>> = {},
): QueueDefinition<DocumentPayload> {
  return defineQueue({
    name,
    payloadSchema: documentSchema,
    retry: RETRY,
    worker: { localConcurrency: 1, pollingIntervalSeconds: FAST_JOB_POLLING_SECONDS },
    ...overrides,
  });
}

describe("PgBossJobQueueAdapter 내구성 통합 테스트 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let transaction: ReturnType<typeof createDatabaseTransactionFixture>;

  function createJobQueue(): PgBossJobQueueAdapter {
    boss = new PgBoss({
      connectionString: testDatabase.getConnectionUri(),
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
    });
    return new PgBossJobQueueAdapter(boss, transaction.txHost, new JobQueueRegistry(), {
      shutdownTimeoutMs: 10_000,
      workerEnabled: true,
    });
  }

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

    transaction = createDatabaseTransactionFixture(client);
    jobQueue = createJobQueue();
    await jobQueue.start();

    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS public.job_runtime_probe (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  });

  afterAll(async () => {
    await jobQueue?.stop();
    await testDatabase?.stop();
  });

  it("enqueue한 작업을 처리하고 완료 상태로 보존한다", async () => {
    // Given
    const queue = documentQueue("integration-complete");
    const id = await jobQueue.enqueue(queue, { documentId: 1 }, { idempotencyKey: "complete:1" });
    const handled = vi.fn().mockResolvedValue(undefined);

    // When
    await jobQueue.work(queue, handled);

    // Then
    await vi.waitFor(async () => {
      expect(handled).toHaveBeenCalledTimes(1);
      const jobs = await boss.findJobs(queue.name, { id: id ?? undefined });
      expect(jobs[0]?.state).toBe("completed");
    }, WORKER_WAIT);
  });

  it("startAfter 전에는 처리하지 않고 이후에 처리한다", async () => {
    // Given
    const queue = documentQueue("integration-delayed");
    const handled = vi.fn().mockResolvedValue(undefined);
    // pg-boss가 startAfter를 DB 시계와 비교하므로 지연도 DB 시계에서 잰다
    const {
      rows: [clock],
    } = await testDatabase
      .getClient()
      .execute<{ nowMs: number }>(
        sql`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS "nowMs"`,
      );
    if (clock == null) {
      throw new Error("DB 시각을 읽지 못했다");
    }
    await jobQueue.enqueue(
      queue,
      { documentId: 2 },
      {
        idempotencyKey: "delayed:2",
        startAfter: Temporal.Instant.fromEpochMilliseconds(Math.ceil(clock.nowMs) + 3000),
      },
    );

    // When
    await jobQueue.work(queue, handled);

    // Then
    // 일어나지 않음을 보는 확인이라 등록 직후 fetch와 polling 한 번이 지날 만큼만 기다린다
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(handled).not.toHaveBeenCalled();
    await vi.waitFor(async () => {
      expect(handled).toHaveBeenCalledTimes(1);
    }, WORKER_WAIT);
  });

  it("enqueueMany는 한 번에 등록하고 이미 있는 idempotencyKey는 enqueue처럼 건너뛴다", async () => {
    // Given
    const queue = documentQueue("integration-enqueue-many");
    await jobQueue.enqueue(queue, { documentId: 1 }, { idempotencyKey: "many:1" });

    // When
    await jobQueue.enqueueMany(queue, [
      { payload: { documentId: 1 }, idempotencyKey: "many:1" },
      { payload: { documentId: 2 }, idempotencyKey: "many:2" },
    ]);

    // Then
    const first = await boss.findJobs(queue.name, { key: "many:1" });
    const second = await boss.findJobs(queue.name, { key: "many:2" });
    expect(first).toHaveLength(1);
    expect(second.map((job) => job.data)).toEqual([{ documentId: 2 }]);
  });

  it("재시도 소진 작업을 dead-letter queue에 보존한다", async () => {
    // Given
    const deadLetterQueue = documentQueue("integration-retry-dead-letter");
    const queue = documentQueue("integration-retry", {
      deadLetter: { queue: deadLetterQueue.name, jobPolicy: RETRY },
    });
    const handled = vi.fn().mockRejectedValue(new Error("expected failure"));
    const deadLetterHandled = vi.fn().mockRejectedValue(new Error("database still unavailable"));
    await jobQueue.work(deadLetterQueue, deadLetterHandled);
    await jobQueue.enqueue(queue, { documentId: 4 }, { idempotencyKey: "retry:4" });

    // When
    await jobQueue.work(queue, handled);

    // Then
    await vi.waitFor(async () => {
      expect(handled).toHaveBeenCalledTimes(2);
      const deadJobs = await boss.findJobs(deadLetterQueue.name);
      expect(deadJobs).toHaveLength(1);
      expect(deadJobs[0]?.data).toEqual({ documentId: 4 });
      expect(deadLetterHandled).toHaveBeenCalledTimes(2);
      expect(deadJobs[0]?.state).toBe("failed");
      await expect(boss.getQueue(deadLetterQueue.name)).resolves.toMatchObject({
        retryLimit: 1,
        retryDelay: 1,
        retryBackoff: false,
      });
    }, WORKER_WAIT);
  });

  it("같은 스케줄 key 등록은 하나의 스케줄로 교체된다", async () => {
    // Given
    const schedule = { key: "weekly", timezone: "UTC", missed: "skip" } as const;
    const first = documentQueue("integration-schedule", {
      schedules: [{ ...schedule, cron: "0 1 * * 1", payload: { documentId: 1 } }],
    });
    const second = documentQueue("integration-schedule", {
      schedules: [{ ...schedule, cron: "0 2 * * 1", payload: { documentId: 2 } }],
    });

    // When
    await jobQueue.registerSchedules(first);
    await jobQueue.registerSchedules(second);

    // Then
    const schedules = await boss.getSchedules(first.name, "weekly");
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      name: first.name,
      key: "weekly",
      cron: "0 2 * * 1",
      data: { documentId: 2 },
    });
  });

  it("API 재시작 중에도 대기 작업이 유실되지 않는다", async () => {
    // Given
    const queue = documentQueue("integration-restart");
    const id = await jobQueue.enqueue(queue, { documentId: 5 }, { idempotencyKey: "restart:5" });
    await jobQueue.stop();

    // When
    jobQueue = createJobQueue();
    await jobQueue.start();
    const handled = vi.fn().mockResolvedValue(undefined);
    await jobQueue.work(queue, handled);

    // Then
    await vi.waitFor(async () => {
      expect(handled).toHaveBeenCalledTimes(1);
      const jobs = await boss.findJobs(queue.name, { id: id ?? undefined });
      expect(jobs[0]?.state).toBe("completed");
    }, WORKER_WAIT);
  });

  it("업무 트랜잭션 rollback 시 업무 row와 queue row가 함께 사라진다", async () => {
    // Given
    const client = testDatabase.getClient();
    const queue = documentQueue("integration-transaction");
    const probeId = "rollback-probe";

    // When
    const outcome = transaction.uow.run(async () => {
      await transaction.txHost.tx.execute(
        sql`INSERT INTO public.job_runtime_probe (id) VALUES (${probeId})`,
      );
      await jobQueue.enqueue(queue, { documentId: 6 }, { idempotencyKey: probeId });
      await jobQueue.enqueueMany(queue, [
        { payload: { documentId: 6 }, idempotencyKey: `${probeId}:batch` },
      ]);
      throw new Error("force rollback");
    });

    // Then
    await expect(outcome).rejects.toThrow("force rollback");
    const { rows } = await client.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM public.job_runtime_probe WHERE id = ${probeId}`,
    );
    const jobs = await boss.findJobs(queue.name, { key: probeId });
    const batchJobs = await boss.findJobs(queue.name, { key: `${probeId}:batch` });
    expect(rows[0]?.count).toBe(0);
    expect(jobs).toHaveLength(0);
    expect(batchJobs).toHaveLength(0);
  });
});
