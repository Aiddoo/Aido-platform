import { PgBoss } from "pg-boss";
import { z } from "zod";

import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import {
  defineQueue,
  type JobEnvelope,
  type JobRetryPolicy,
  type QueueDefinition,
} from "#api/shared/application/ports/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

const SCHEMA = "pgboss";

const RETRY: JobRetryPolicy = {
  retryLimit: 0,
  retryDelaySeconds: 1,
  retryBackoff: false,
  expireInSeconds: 30,
  retentionSeconds: 14 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
};

const documentSchema = z.object({
  documentId: z.number().int(),
  // 옛 작업에 없던 필드도 소비 때 parse로 기본값을 채운다
  locale: z.string().default("ko"),
});

type DocumentPayload = z.infer<typeof documentSchema>;

function documentQueue(
  name: string,
  worker: Partial<QueueDefinition<DocumentPayload>["worker"]> = {},
): QueueDefinition<DocumentPayload> {
  return defineQueue({
    name,
    payloadSchema: documentSchema,
    retry: RETRY,
    worker: { localConcurrency: 1, pollingIntervalSeconds: 0.5, ...worker },
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

describe("PgBossJobQueueAdapter 통합 테스트 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;
  let registry: JobQueueRegistry;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    const client = await testDatabase.start();
    const connectionString = testDatabase.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });

    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
    });
    await boss.start();
    registry = new JobQueueRegistry();
    jobQueue = new PgBossJobQueueAdapter(
      boss,
      createDatabaseTransactionFixture(client).txHost,
      registry,
    );
  });

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    await testDatabase?.stop();
  });

  it("enqueue한 작업을 worker가 정의의 schema로 parse한 payload로 받는다", async () => {
    // Given
    const queue = documentQueue("integration-queue-parse");
    const received: JobEnvelope<DocumentPayload>[] = [];
    await jobQueue.enqueue(queue, { documentId: 1, locale: "en" });
    await boss.send(queue.name, { documentId: 2 });

    // When
    await jobQueue.work(queue, async (jobs) => {
      received.push(...jobs);
    });

    // Then
    await eventually(() => {
      expect(received.map(({ data }) => data)).toEqual(
        expect.arrayContaining([
          { documentId: 1, locale: "en" },
          { documentId: 2, locale: "ko" },
        ]),
      );
    });
    expect(registry.queueNames()).toContain(queue.name);
  });

  it("schema에 맞지 않는 payload는 handler에 오지 않고 실패로 남는다", async () => {
    // Given
    const queue = documentQueue("integration-queue-invalid", { batchSize: 5 });
    const received: unknown[] = [];
    await jobQueue.enqueue(queue, { documentId: 3, locale: "ko" });
    const invalidId = await boss.send(queue.name, { documentId: "not-a-number" });

    // When
    await jobQueue.work(queue, async (jobs) => {
      received.push(...jobs.map(({ data }) => data));
    });

    // Then
    await eventually(async () => {
      const [invalid] = await boss.findJobs(queue.name, { id: invalidId ?? undefined });
      expect(invalid?.state).toBe("failed");
      expect(received).toEqual([{ documentId: 3, locale: "ko" }]);
    });
  });

  it("같은 idempotencyKey로 두 번 등록하면 한 번만 처리한다", async () => {
    // Given
    const queue = documentQueue("integration-queue-idempotent");
    const received: number[] = [];

    // When
    const first = await jobQueue.enqueue(
      queue,
      { documentId: 4, locale: "ko" },
      { idempotencyKey: "document:4" },
    );
    const duplicate = await jobQueue.enqueue(
      queue,
      { documentId: 4, locale: "ko" },
      { idempotencyKey: "document:4" },
    );
    await jobQueue.work(queue, async (jobs) => {
      received.push(...jobs.map(({ data }) => data.documentId));
    });

    // Then
    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
    await eventually(() => {
      expect(received).toEqual([4]);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(received).toEqual([4]);
  });

  it("minPriority 10 worker는 우선순위 0 작업이 쌓여 있어도 10 작업만 가져간다", async () => {
    // Given
    const queue = documentQueue("integration-queue-priority");
    const transactional = documentQueue(queue.name, { minPriority: 10 });
    const received: number[] = [];
    await jobQueue.enqueueMany(queue, [
      { payload: { documentId: 10, locale: "ko" } },
      { payload: { documentId: 11, locale: "ko" } },
      { payload: { documentId: 12, locale: "ko" } },
    ]);
    await jobQueue.enqueue(queue, { documentId: 99, locale: "ko" }, { priority: 10 });

    // When
    await jobQueue.work(transactional, async (jobs) => {
      received.push(...jobs.map(({ data }) => data.documentId));
    });

    // Then
    await eventually(() => {
      expect(received).toEqual([99]);
    });
    const marketing = await boss.findJobs(queue.name, { queued: true });
    expect(marketing.map(({ data }) => data)).toHaveLength(3);
  });

  it("isolateJobFailures worker는 묶음에서 실패한 작업만 실패로 남기고 나머지는 한 번만 처리한다", async () => {
    // Given
    const queue = documentQueue("integration-queue-isolated", {
      batchSize: 3,
      burstWhenBatchFull: true,
      isolateJobFailures: true,
    });
    const ids = await Promise.all(
      [20, 21, 22].map((documentId) => jobQueue.enqueue(queue, { documentId, locale: "ko" })),
    );
    const handled: number[] = [];

    // When
    await jobQueue.work(queue, async (jobs) => {
      for (const { data } of jobs) {
        handled.push(data.documentId);
        if (data.documentId === 21) {
          throw new Error("document 21 failed");
        }
      }
    });

    // Then
    await eventually(async () => {
      const states = await Promise.all(
        ids.map(async (id) => (await boss.findJobs(queue.name, { id: id ?? undefined }))[0]?.state),
      );
      expect(states).toEqual(["completed", "failed", "completed"]);
    });
    expect(handled.sort()).toEqual([20, 21, 22]);
  });

  it("스케줄은 정의의 missed 정책과 key로 등록한다", async () => {
    // Given
    const queue = defineQueue({
      ...documentQueue("integration-queue-schedule"),
      schedules: [
        {
          key: "daily-document",
          cron: "0 3 * * *",
          timezone: "Asia/Seoul",
          missed: "once",
          payload: { documentId: 5, locale: "ko" },
        },
      ],
    });

    // When
    await jobQueue.registerSchedules(queue);

    // Then
    const [schedule] = await boss.getSchedules(queue.name, "daily-document");
    expect(schedule).toMatchObject({
      cron: "0 3 * * *",
      timezone: "Asia/Seoul",
      data: { documentId: 5, locale: "ko" },
      options: { missed: "once" },
    });
  });
});
