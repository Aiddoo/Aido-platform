import type {
  Db,
  InsertOptions,
  JobInsert,
  JobWithMetadata,
  PreviewScheduleOptions,
  QueueOptions,
  Schedule,
  ScheduleOptions,
  SendOptions,
  StopOptions,
  UpdateQueueOptions,
  WorkOptions,
} from "pg-boss";
import { vi } from "vitest";
import { z } from "zod";

import { defineQueue } from "#api/shared/application/ports/job-queue.port";
import { createFakeDatabase, type ExecutedStatement } from "#test/mocks/drizzle.mock";

import { JobQueueRegistry } from "./job-queue.registry.js";
import { LazyPgBossClient, type PgBossClient, type PgBossQueueCounts } from "./pg-boss-client.js";
import { deterministicJobId, PgBossJobQueueAdapter } from "./pg-boss-job-queue.adapter.js";

const QUEUE = "document-generation";
const DEAD_LETTER_QUEUE = "document-generation-dead-letter";

const DEAD_LETTER_JOB_POLICY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 600,
  retentionSeconds: 14 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const;

// pg-boss 큐 옵션 이름으로 옮긴 DEAD_LETTER_JOB_POLICY
const PG_BOSS_POLICY = {
  retryLimit: 2,
  retryDelay: 5,
  retryBackoff: true,
  expireInSeconds: 600,
  retentionSeconds: 1_209_600,
  deleteAfterSeconds: 604_800,
} as const;

const START_AFTER = Temporal.Instant.from("2026-07-22T12:00:00.000Z");
const documentSchema = z.object({ documentId: z.number() });

const DOCUMENT_QUEUE = defineQueue({
  name: QUEUE,
  payloadSchema: documentSchema,
  retry: DEAD_LETTER_JOB_POLICY,
  deadLetter: { queue: DEAD_LETTER_QUEUE, jobPolicy: DEAD_LETTER_JOB_POLICY },
  worker: { localConcurrency: 2, pollingIntervalSeconds: 2 },
});

const DEAD_LETTER_DEFINITION = defineQueue({
  name: DEAD_LETTER_QUEUE,
  payloadSchema: documentSchema,
  retry: DEAD_LETTER_JOB_POLICY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: 2 },
});

class FakePgBossClient implements PgBossClient {
  readonly createdQueues: string[] = [];
  readonly createQueueCalls: Array<{ readonly name: string; readonly options?: QueueOptions }> = [];
  readonly updateQueueCalls: Array<{
    readonly name: string;
    readonly options: UpdateQueueOptions;
  }> = [];
  readonly sendCalls: Array<{
    name: string;
    data: object;
    options: SendOptions;
  }> = [];
  readonly insertCalls: Array<{ name: string; jobs: JobInsert[]; options: InsertOptions }> = [];
  readonly scheduleCalls: Array<{
    name: string;
    cron: string;
    data: object;
    options: ScheduleOptions;
  }> = [];
  readonly deleteCalls: Array<{
    name: string;
    ids: string[];
    options?: { db?: Db };
  }> = [];
  readonly stopCalls: StopOptions[] = [];
  readonly handlers = new Map<string, (jobs: JobWithMetadata<object>[]) => Promise<unknown>>();
  queues: PgBossQueueCounts[] = [];
  deleteError?: Error;

  async start(): Promise<unknown> {
    return this;
  }

  async stop(options?: StopOptions): Promise<void> {
    this.stopCalls.push(options ?? {});
  }

  on(_event: "error", _listener: (error: Error) => void): unknown {
    return this;
  }

  async createQueue(name: string, options?: QueueOptions): Promise<void> {
    this.createdQueues.push(name);
    this.createQueueCalls.push({ name, options });
  }

  async updateQueue(name: string, options: UpdateQueueOptions): Promise<void> {
    this.updateQueueCalls.push({ name, options });
  }

  async send(name: string, data: object, options: SendOptions): Promise<string | null> {
    this.sendCalls.push({ name, data, options });
    return "job-1";
  }

  async insert(name: string, jobs: JobInsert[], options: InsertOptions): Promise<string[] | null> {
    this.insertCalls.push({ name, jobs, options });
    return null;
  }

  async schedule(
    name: string,
    cron: string,
    data: object,
    options: ScheduleOptions,
  ): Promise<void> {
    this.scheduleCalls.push({ name, cron, data, options });
  }

  async unschedule(_name: string, _key?: string): Promise<void> {}

  async deleteJob(name: string, ids: string[], options?: { db?: Db }): Promise<unknown> {
    if (this.deleteError) {
      throw this.deleteError;
    }
    this.deleteCalls.push({ name, ids, options });
    return { jobs: ids, requested: ids.length, affected: ids.length };
  }

  async work(
    name: string,
    _options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<object>[]) => Promise<unknown>,
  ): Promise<string> {
    this.handlers.set(name, handler);
    return `worker:${name}`;
  }

  async getQueues(_names?: string[]): Promise<PgBossQueueCounts[]> {
    return this.queues;
  }

  async getSchedules(): Promise<Schedule[]> {
    return [];
  }

  previewSchedule(_cron: string, _options: PreviewScheduleOptions): Date[] {
    return [];
  }
}

function job(overrides: Partial<JobWithMetadata<object>> = {}): JobWithMetadata<object> {
  const createdOn = new Date("2026-07-22T11:59:00.000Z");
  return {
    id: "job-1",
    name: QUEUE,
    data: { documentId: 42 },
    expireInSeconds: 900,
    heartbeatSeconds: null,
    retryCount: 1,
    signal: new AbortController().signal,
    priority: 0,
    state: "created",
    retryLimit: 2,
    retryDelay: 0,
    retryBackoff: false,
    startAfter: createdOn,
    startedOn: createdOn,
    singletonKey: null,
    singletonOn: null,
    deleteAfterSeconds: 0,
    createdOn,
    completedOn: null,
    keepUntil: createdOn,
    policy: "standard",
    heartbeatOn: null,
    blocked: false,
    blocking: false,
    pendingDependencies: 0,
    deadLetter: "",
    output: {},
    sourceName: null,
    sourceId: null,
    sourceCreatedOn: null,
    sourceRetryCount: null,
    sourceOutput: null,
    sourceRootId: null,
    ...overrides,
  };
}

describe("PgBossJobQueueAdapter — PostgreSQL 영속 큐", () => {
  let boss: FakePgBossClient;
  let statements: ExecutedStatement[];
  let registry: JobQueueRegistry;
  let jobQueue: PgBossJobQueueAdapter;

  beforeEach(() => {
    boss = new FakePgBossClient();
    const fake = createFakeDatabase();
    statements = fake.statements;
    registry = new JobQueueRegistry();
    jobQueue = new PgBossJobQueueAdapter(boss, { tx: fake.database }, registry, {
      shutdownTimeoutMs: 90_000,
      workerEnabled: true,
    });
  });

  it("enqueue 옵션과 현재 CLS 트랜잭션을 pg-boss에 그대로 매핑한다", async () => {
    // When
    const enqueued = jobQueue.enqueue(
      DOCUMENT_QUEUE,
      { documentId: 42 },
      { idempotencyKey: "document:42", startAfter: START_AFTER },
    );

    // Then
    await expect(enqueued).resolves.toBe("job-1");
    expect(boss.createdQueues).toEqual([DEAD_LETTER_QUEUE, QUEUE]);
    expect(boss.createQueueCalls[0]).toEqual({
      name: DEAD_LETTER_QUEUE,
      options: PG_BOSS_POLICY,
    });
    expect(boss.updateQueueCalls).toEqual([
      { name: DEAD_LETTER_QUEUE, options: PG_BOSS_POLICY },
      { name: QUEUE, options: PG_BOSS_POLICY },
    ]);
    expect(boss.sendCalls).toHaveLength(1);
    expect(boss.sendCalls[0]).toMatchObject({
      name: QUEUE,
      data: { documentId: 42 },
      options: {
        id: "f987b5bb-6102-5d54-8212-2fe4b94ed26e",
        singletonKey: "document:42",
        startAfter: new Date("2026-07-22T12:00:00.000Z"),
        ...PG_BOSS_POLICY,
        deadLetter: DEAD_LETTER_QUEUE,
      },
    });

    await boss.sendCalls[0]?.options.db?.executeSql("SELECT $1::uuid AS id", [
      "00000000-0000-4000-8000-000000000001",
    ]);
    expect(statements).toHaveLength(1);
  });

  it("enqueueMany는 enqueue와 같은 작업 옵션으로 현재 CLS 트랜잭션에서 한 번에 insert한다", async () => {
    // When
    await jobQueue.enqueueMany(DOCUMENT_QUEUE, [
      { payload: { documentId: 42 }, idempotencyKey: "document:42", startAfter: START_AFTER },
      { payload: { documentId: 43 }, idempotencyKey: "document:43" },
    ]);

    // Then
    expect(boss.createdQueues).toEqual([DEAD_LETTER_QUEUE, QUEUE]);
    expect(boss.sendCalls).toHaveLength(0);
    expect(boss.insertCalls).toHaveLength(1);
    expect(boss.insertCalls[0]?.name).toBe(QUEUE);
    expect(boss.insertCalls[0]?.jobs).toEqual([
      expect.objectContaining({
        id: "f987b5bb-6102-5d54-8212-2fe4b94ed26e",
        singletonKey: "document:42",
        data: { documentId: 42 },
        retryLimit: 2,
        deadLetter: DEAD_LETTER_QUEUE,
      }),
      expect.objectContaining({ singletonKey: "document:43", data: { documentId: 43 } }),
    ]);

    await boss.insertCalls[0]?.options.db?.executeSql("SELECT $1::uuid AS id", [
      "00000000-0000-4000-8000-000000000001",
    ]);
    expect(statements).toHaveLength(1);
  });

  it("빈 enqueueMany는 큐와 작업을 쓰지 않는다", async () => {
    // When
    await jobQueue.enqueueMany(DOCUMENT_QUEUE, []);

    // Then
    expect(boss.createdQueues).toEqual([]);
    expect(boss.insertCalls).toEqual([]);
  });

  it("DLQ worker가 enqueue보다 먼저 등록돼도 DLQ 정책을 한 번만 맞춘다", async () => {
    // Given
    await jobQueue.work(DEAD_LETTER_DEFINITION, vi.fn().mockResolvedValue(undefined));

    // When
    await jobQueue.enqueue(DOCUMENT_QUEUE, { documentId: 42 }, { idempotencyKey: "document:42" });

    // Then
    expect(boss.createQueueCalls.filter(({ name }) => name === DEAD_LETTER_QUEUE)).toEqual([
      { name: DEAD_LETTER_QUEUE, options: PG_BOSS_POLICY },
    ]);
    expect(boss.updateQueueCalls.filter(({ name }) => name === DEAD_LETTER_QUEUE)).toHaveLength(1);
  });

  it("idempotencyKey를 결정적 pg-boss id와 singletonKey로 매핑한다", async () => {
    // When
    await jobQueue.enqueue(DOCUMENT_QUEUE, { documentId: 42 }, { idempotencyKey: "document_42" });

    // Then
    expect(boss.sendCalls[0]?.options).toMatchObject({
      id: "01d4ac50-5c6a-5317-bd4e-b1cf809b8f59",
      singletonKey: "document_42",
    });
  });

  it("정의의 스케줄을 key로 upsert하고 작업 id·트랜잭션은 넘기지 않는다", async () => {
    // Given
    const queue = defineQueue({
      ...DOCUMENT_QUEUE,
      schedules: [
        {
          key: "weekly-document",
          cron: "0 1 * * 1",
          timezone: "Asia/Seoul",
          missed: "skip",
          payload: { documentId: 42 },
        },
      ],
    });

    // When
    await jobQueue.registerSchedules(queue);

    // Then
    expect(boss.scheduleCalls).toHaveLength(1);
    expect(boss.scheduleCalls[0]).toMatchObject({
      name: QUEUE,
      cron: "0 1 * * 1",
      data: { documentId: 42 },
      options: { key: "weekly-document", tz: "Asia/Seoul", missed: "skip" },
    });
    expect(boss.scheduleCalls[0]?.options).not.toHaveProperty("db");
    expect(boss.scheduleCalls[0]?.options).not.toHaveProperty("singletonKey");
    expect(boss.scheduleCalls[0]?.options).not.toHaveProperty("id");
  });

  it("worker 묶음을 schema로 parse한 vendor-neutral envelope로 변환한다", async () => {
    // Given
    const handler = vi.fn().mockResolvedValue(undefined);
    await jobQueue.work(DOCUMENT_QUEUE, handler);
    const worker = boss.handlers.get(QUEUE);

    // When
    await worker?.([job()]);

    // Then
    expect(handler).toHaveBeenCalledWith([
      { id: "job-1", name: QUEUE, data: { documentId: 42 }, attempt: 2 },
    ]);
  });

  it("cancel은 상태를 가리지 않고 결정적 id로 한 번에 지운다", async () => {
    // When
    await jobQueue.cancel(DOCUMENT_QUEUE, ["document:42", "document:43"]);

    // Then
    expect(boss.deleteCalls).toEqual([
      {
        name: QUEUE,
        ids: [deterministicJobId(QUEUE, "document:42"), deterministicJobId(QUEUE, "document:43")],
        options: { db: expect.anything() },
      },
    ]);
  });

  it("cancel은 key가 없으면 pg-boss를 부르지 않는다", async () => {
    // When
    await jobQueue.cancel(DOCUMENT_QUEUE, []);

    // Then
    expect(boss.deleteCalls).toHaveLength(0);
  });

  it("cancel은 pg-boss 오류를 그대로 전파한다", async () => {
    // Given
    boss.deleteError = new Error("postgres unavailable");

    // When
    const cancellation = jobQueue.cancel(DOCUMENT_QUEUE, ["document:42"]);

    // Then
    await expect(cancellation).rejects.toThrow("postgres unavailable");
  });

  it("worker를 끈 프로세스는 소비·스케줄을 등록하지 않고 작업 넣기와 health 큐 목록만 유지한다", async () => {
    // Given
    const apiOnly = new PgBossJobQueueAdapter(
      boss,
      { tx: createFakeDatabase().database },
      registry,
      {
        shutdownTimeoutMs: 90_000,
        workerEnabled: false,
      },
    );
    const scheduled = defineQueue({
      ...DOCUMENT_QUEUE,
      schedules: [
        {
          key: "weekly-document",
          cron: "0 1 * * 1",
          timezone: "Asia/Seoul",
          missed: "skip",
          payload: { documentId: 42 },
        },
      ],
    });

    // When
    await apiOnly.work(DOCUMENT_QUEUE, async () => {});
    await apiOnly.registerSchedules(scheduled);
    const enqueued = await apiOnly.enqueue(DOCUMENT_QUEUE, { documentId: 42 });

    // Then
    expect(boss.handlers.size).toBe(0);
    expect(boss.scheduleCalls).toEqual([]);
    expect(enqueued).toBe("job-1");
    expect(registry.queueNames()).toEqual(expect.arrayContaining([QUEUE, DEAD_LETTER_QUEUE]));
  });

  it("정의로 쓴 큐와 그 DLQ의 상태를 공통 health 모델로 정규화한다", async () => {
    // Given
    registry.register(DOCUMENT_QUEUE);
    boss.queues = [{ name: QUEUE, queuedCount: 3, activeCount: 1, failedCount: 2 }];

    // When
    const health = await jobQueue.health();

    // Then
    expect(health).toEqual({
      backend: "postgres",
      degraded: false,
      queues: {
        [QUEUE]: { waiting: 3, active: 1, failed: 2, oldestAgeSeconds: null },
        [DEAD_LETTER_QUEUE]: { waiting: 0, active: 0, failed: 0, oldestAgeSeconds: null },
      },
    });
  });

  it("상태 조회가 실패하면 throw하지 않고 degraded로 돌려준다", async () => {
    // Given
    registry.register(DOCUMENT_QUEUE);
    vi.spyOn(boss, "getQueues").mockRejectedValue(new Error("database unavailable"));

    // When
    const health = await jobQueue.health();

    // Then
    expect(health).toMatchObject({ degraded: true, reason: "job_runtime_unavailable" });
  });

  it("종료 시 worker 완료를 최대 90초 기다린다", async () => {
    // When
    await jobQueue.stop();

    // Then
    expect(boss.stopCalls).toEqual([{ graceful: true, timeout: 90_000, close: true }]);
  });
});

describe("LazyPgBossClient — backend 비선택 시 무초기화", () => {
  it("start 전에는 pg-boss 인스턴스와 연결을 생성하지 않는다", async () => {
    // Given
    const client = new FakePgBossClient();
    const load = vi.fn().mockResolvedValue(client);
    const lazyClient = new LazyPgBossClient(load);

    // When
    lazyClient.on("error", vi.fn());

    // Then
    expect(load).not.toHaveBeenCalled();

    await lazyClient.start();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("worker가 lifecycle hook보다 먼저 등록되어도 한 번만 초기화한다", async () => {
    const client = new FakePgBossClient();
    const load = vi.fn().mockResolvedValue(client);
    const lazyClient = new LazyPgBossClient(load);

    await Promise.all([
      lazyClient.createQueue(QUEUE),
      lazyClient.work(QUEUE, { includeMetadata: true }, async () => undefined),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(client.createdQueues).toEqual([QUEUE]);
    expect(client.handlers.has(QUEUE)).toBe(true);
  });

  it("선택하지 않은 runtime을 종료해도 인스턴스를 만들지 않는다", async () => {
    // Given
    const load = vi.fn(() => new FakePgBossClient());
    const client = new LazyPgBossClient(load);

    // When
    await client.stop();

    // Then
    expect(load).not.toHaveBeenCalled();
  });

  it("종료 뒤 늦게 도착한 요청은 새 인스턴스를 띄우지 않고 실패한다", async () => {
    // Given
    const load = vi.fn(() => new FakePgBossClient());
    const client = new LazyPgBossClient(load);
    await client.start();
    await client.stop();

    // When
    const lateSend = client.send(QUEUE, {}, {});

    // Then
    await expect(lateSend).rejects.toThrow("pg-boss client is stopped");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("시작 실패 시 열린 자원을 닫고 다음 요청에서 새 인스턴스로 재시도한다", async () => {
    // Given
    const first = new FakePgBossClient();
    const next = new FakePgBossClient();
    const failure = new Error("startup failed");
    vi.spyOn(first, "start").mockRejectedValue(failure);
    const load = vi.fn().mockReturnValueOnce(first).mockReturnValue(next);
    const client = new LazyPgBossClient(load);

    // When
    await expect(client.start()).rejects.toBe(failure);
    await client.start();

    // Then
    expect(first.stopCalls).toEqual([{ graceful: false, close: true }]);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
