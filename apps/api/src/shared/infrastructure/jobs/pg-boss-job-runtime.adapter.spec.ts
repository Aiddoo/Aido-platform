import type {
  Db,
  FindJobsOptions,
  JobWithMetadata,
  QueueOptions,
  QueueResult,
  ScheduleOptions,
  SendOptions,
  StopOptions,
  UpdateQueueOptions,
  WorkOptions,
} from "pg-boss";
import { vi } from "vitest";

import type { EnqueueJobOptions, JobData } from "#api/shared/application/ports/job-runtime.port";
import { createMockDatabaseContext } from "#test/mocks/database.mock";

import {
  LazyPgBossClient,
  PgBossJobRuntimeAdapter,
  type PgBossClient,
} from "./pg-boss-job-runtime.adapter.js";

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

function enqueueOptions(idempotencyKey = "document:42"): EnqueueJobOptions {
  return {
    idempotencyKey,
    startAfter: new Date("2026-07-22T12:00:00.000Z"),
    retryLimit: 2,
    retryDelaySeconds: 5,
    retryBackoff: true,
    expireInSeconds: 600,
    retentionSeconds: 14 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
    deadLetter: { queue: DEAD_LETTER_QUEUE, jobPolicy: DEAD_LETTER_JOB_POLICY },
    timezone: "Asia/Seoul",
  };
}

function legacyEnqueueOptions(): EnqueueJobOptions {
  return {
    jobKey: "document_42",
    startAfter: new Date("2026-07-22T12:00:00.000Z"),
    retryLimit: 2,
    retryDelaySeconds: 5,
    retryBackoff: true,
    expireInSeconds: 600,
    retentionSeconds: 14 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
    deadLetter: "document-generation-dead-letter",
    timezone: "Asia/Seoul",
  };
}

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
  readonly scheduleCalls: Array<{
    name: string;
    cron: string;
    data: object;
    options: ScheduleOptions;
  }> = [];
  readonly cancelCalls: Array<{
    name: string;
    ids: string[];
    options?: { db?: Db };
  }> = [];
  readonly stopCalls: StopOptions[] = [];
  readonly handlers = new Map<string, (jobs: JobWithMetadata<JobData>[]) => Promise<unknown>>();
  jobs: JobWithMetadata<JobData>[] = [];
  queues: QueueResult[] = [];
  findJobsError?: Error;
  cancelError?: Error;
  cancelAffected = 1;
  malformedCancelResponse = false;

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

  async schedule(
    name: string,
    cron: string,
    data: object,
    options: ScheduleOptions,
  ): Promise<void> {
    this.scheduleCalls.push({ name, cron, data, options });
  }

  async unschedule(_name: string, _key?: string): Promise<void> {}

  async findJobs<T extends JobData>(
    _name: string,
    options?: FindJobsOptions,
  ): Promise<JobWithMetadata<T>[]> {
    if (this.findJobsError) {
      throw this.findJobsError;
    }
    const jobs = options?.queued
      ? this.jobs.filter(({ state }) => state === "created" || state === "retry")
      : this.jobs;
    return jobs as JobWithMetadata<T>[];
  }

  async cancel(name: string, ids: string[], options?: { db?: Db }): Promise<unknown> {
    if (this.cancelError) {
      throw this.cancelError;
    }
    this.cancelCalls.push({ name, ids, options });
    if (this.malformedCancelResponse) {
      return undefined;
    }
    return {
      jobs: ids,
      requested: ids.length,
      affected: this.cancelAffected,
    };
  }

  async work<T extends JobData>(
    name: string,
    _options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<T>[]) => Promise<unknown>,
  ): Promise<string> {
    this.handlers.set(name, handler as (jobs: JobWithMetadata<JobData>[]) => Promise<unknown>);
    return `worker:${name}`;
  }

  async getQueues(_names?: string[]): Promise<QueueResult[]> {
    return this.queues;
  }
}

function job(overrides: Partial<JobWithMetadata<JobData>> = {}): JobWithMetadata<JobData> {
  return {
    id: "job-1",
    name: QUEUE,
    data: { documentId: 42 },
    state: "created",
    retryCount: 1,
    createdOn: new Date("2026-07-22T11:59:00.000Z"),
    ...overrides,
  } as JobWithMetadata<JobData>;
}

describe("PgBossJobRuntimeAdapter — PostgreSQL durable runtime", () => {
  let boss: FakePgBossClient;
  let context: ReturnType<typeof createMockDatabaseContext>;
  let runtime: PgBossJobRuntimeAdapter;

  beforeEach(() => {
    boss = new FakePgBossClient();
    context = createMockDatabaseContext();
    context.query.mockResolvedValue([]);
    runtime = new PgBossJobRuntimeAdapter(
      boss,
      { tx: context },
      { job: { shutdownTimeoutMs: 90_000 } },
    );
  });

  it("enqueue 옵션과 현재 CLS 트랜잭션을 pg-boss에 그대로 매핑한다", async () => {
    const options = enqueueOptions();

    await expect(runtime.enqueue(QUEUE, { documentId: 42 }, options)).resolves.toBe("job-1");

    expect(boss.createdQueues).toEqual(["document-generation-dead-letter", QUEUE]);
    expect(boss.createQueueCalls[0]).toEqual({
      name: DEAD_LETTER_QUEUE,
      options: {
        retryLimit: 2,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 600,
        retentionSeconds: 1_209_600,
        deleteAfterSeconds: 604_800,
      },
    });
    expect(boss.updateQueueCalls).toEqual([
      {
        name: DEAD_LETTER_QUEUE,
        options: {
          retryLimit: 2,
          retryDelay: 5,
          retryBackoff: true,
          expireInSeconds: 600,
          retentionSeconds: 1_209_600,
          deleteAfterSeconds: 604_800,
        },
      },
    ]);
    expect(boss.sendCalls).toHaveLength(1);
    expect(boss.sendCalls[0]).toMatchObject({
      name: QUEUE,
      data: { documentId: 42 },
      options: {
        id: "f987b5bb-6102-5d54-8212-2fe4b94ed26e",
        singletonKey: "document:42",
        startAfter: options.startAfter,
        retryLimit: 2,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 600,
        retentionSeconds: 1_209_600,
        deleteAfterSeconds: 604_800,
        deadLetter: "document-generation-dead-letter",
      },
    });

    await boss.sendCalls[0]?.options.db?.executeSql("SELECT $1::uuid AS id", [
      "00000000-0000-4000-8000-000000000001",
    ]);
    expect(context.query).toHaveBeenCalledOnce();
  });

  it("DLQ worker가 enqueue보다 먼저 등록돼도 typed retry policy로 수렴한다", async () => {
    await runtime.work(DEAD_LETTER_QUEUE, vi.fn().mockResolvedValue(undefined), {
      teamSize: 1,
      pollingIntervalSeconds: 2,
      queuePolicy: DEAD_LETTER_JOB_POLICY,
    });
    await runtime.enqueue(QUEUE, { documentId: 42 }, enqueueOptions());

    expect(boss.createQueueCalls.filter(({ name }) => name === DEAD_LETTER_QUEUE)).toEqual([
      {
        name: DEAD_LETTER_QUEUE,
        options: {
          retryLimit: 2,
          retryDelay: 5,
          retryBackoff: true,
          expireInSeconds: 600,
          retentionSeconds: 1_209_600,
          deleteAfterSeconds: 604_800,
        },
      },
    ]);
    expect(boss.updateQueueCalls.filter(({ name }) => name === DEAD_LETTER_QUEUE)).toHaveLength(1);
  });

  it("신규·deprecated identity 이름을 같은 pg-boss identity로 매핑한다", async () => {
    await runtime.enqueue(QUEUE, { documentId: 42 }, enqueueOptions("document_42"));
    await runtime.enqueue(QUEUE, { documentId: 42 }, legacyEnqueueOptions());

    expect(boss.sendCalls[0]?.options).toMatchObject({
      id: "01d4ac50-5c6a-5317-bd4e-b1cf809b8f59",
      singletonKey: "document_42",
    });
    expect(boss.sendCalls[1]?.options).toMatchObject({
      id: "01d4ac50-5c6a-5317-bd4e-b1cf809b8f59",
      singletonKey: "document_42",
    });
  });

  it("동일한 scheduleKey로 스케줄을 upsert한다", async () => {
    await runtime.schedule(
      "weekly-document",
      "0 1 * * 1",
      QUEUE,
      { reportType: "WEEKLY" },
      enqueueOptions(),
    );

    expect(boss.scheduleCalls).toHaveLength(1);
    expect(boss.scheduleCalls[0]).toMatchObject({
      name: QUEUE,
      cron: "0 1 * * 1",
      data: { reportType: "WEEKLY" },
      options: {
        key: "weekly-document",
        tz: "Asia/Seoul",
      },
    });
    expect(boss.scheduleCalls[0]?.options).not.toHaveProperty("db");
    expect(boss.scheduleCalls[0]?.options).not.toHaveProperty("singletonKey");
  });

  it("worker batch를 vendor-neutral envelope로 변환한다", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await runtime.work(QUEUE, handler, {
      teamSize: 2,
      pollingIntervalSeconds: 2,
    });

    const worker = boss.handlers.get(QUEUE);
    expect(worker).toBeDefined();
    await worker?.([job()]);

    expect(handler).toHaveBeenCalledWith([
      {
        id: "job-1",
        name: QUEUE,
        data: { documentId: 42 },
        attempt: 2,
      },
    ]);
  });

  it.each(["created", "retry"] as const)(
    "cancel은 queued 상태인 %s 작업을 취소하고 cancelled를 반환한다",
    async (state) => {
      // Given - 동일 idempotencyKey의 취소 가능한 작업 존재
      boss.jobs = [job({ state })];

      // When & Then - 실제 affected row가 있어 cancelled
      await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
        status: "cancelled",
      });
      expect(boss.cancelCalls).toHaveLength(1);
      expect(boss.cancelCalls[0]).toMatchObject({
        name: QUEUE,
        ids: ["job-1"],
      });
    },
  );

  it.each(["active", "completed", "cancelled", "failed"] as const)(
    "cancel은 레코드가 남아 있어도 %s 작업이면 missing을 반환한다",
    async (state) => {
      // Given - 보존 중이지만 queued가 아닌 작업
      boss.jobs = [job({ state })];

      // When & Then - 취소 API를 호출하지 않음
      await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
        status: "missing",
      });
      expect(boss.cancelCalls).toHaveLength(0);
    },
  );

  it("cancel은 queued 작업을 찾았어도 affected가 0이면 missing을 반환한다", async () => {
    // Given - 조회 뒤 경합으로 실제 취소된 row가 없음
    boss.jobs = [job({ state: "created" })];
    boss.cancelAffected = 0;

    // When & Then - 존재 여부를 취소 성공으로 오인하지 않음
    await expect(runtime.cancel(QUEUE, "document:42")).resolves.toEqual({
      status: "missing",
    });
    expect(boss.cancelCalls).toHaveLength(1);
  });

  it("cancel은 pg-boss 응답에 affected가 없으면 성공이나 missing으로 오인하지 않는다", async () => {
    // Given - 설치된 pg-boss 반환 계약과 다른 응답
    boss.jobs = [job({ state: "created" })];
    boss.malformedCancelResponse = true;

    // When & Then - 벤더 계약 위반을 인프라 실패로 노출
    await expect(runtime.cancel(QUEUE, "document:42")).rejects.toThrow(
      "Invalid pg-boss cancellation response",
    );
  });

  it("cancel은 찾은 작업이 없으면 missing을 반환한다", async () => {
    // Given - 동일 idempotencyKey의 작업 없음
    boss.jobs = [];

    // When & Then - 명시적 missing 결과
    await expect(runtime.cancel(QUEUE, "missing")).resolves.toEqual({
      status: "missing",
    });
    expect(boss.cancelCalls).toHaveLength(0);
  });

  it("cancel은 pg-boss 조회 오류를 missing으로 바꾸지 않고 전파한다", async () => {
    // Given - PostgreSQL 조회 실패
    boss.findJobsError = new Error("postgres unavailable");

    // When & Then - 원래 인프라 오류 전파
    await expect(runtime.cancel(QUEUE, "document:42")).rejects.toThrow("postgres unavailable");
  });

  it("cancel은 pg-boss 취소 오류를 missing으로 바꾸지 않고 전파한다", async () => {
    // Given - 작업은 있지만 취소 실패
    boss.jobs = [job()];
    boss.cancelError = new Error("cancel failed");

    // When & Then - 원래 인프라 오류 전파
    await expect(runtime.cancel(QUEUE, "document:42")).rejects.toThrow("cancel failed");
  });

  it("queue 상태를 공통 health 모델로 정규화한다", async () => {
    boss.queues = [
      {
        name: QUEUE,
        queuedCount: 3,
        activeCount: 1,
        failedCount: 2,
      } as QueueResult,
    ];

    await expect(runtime.health([QUEUE])).resolves.toEqual({
      backend: "postgres",
      degraded: false,
      queues: {
        [QUEUE]: {
          waiting: 3,
          active: 1,
          failed: 2,
          oldestAgeSeconds: null,
        },
      },
    });
  });

  it("종료 시 worker 완료를 최대 90초 기다린다", async () => {
    await runtime.stop();

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
