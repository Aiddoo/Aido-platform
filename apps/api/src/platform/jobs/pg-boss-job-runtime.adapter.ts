import { createHash } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, Optional, type FactoryProvider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { uniqBy } from "es-toolkit";
import type { PoolConfig } from "pg";
import {
  PgBoss,
  type ConstructorOptions,
  type Db,
  type InsertOptions,
  type JobInsert,
  type JobWithMetadata,
  type PreviewScheduleOptions,
  type QueueOptions,
  type QueueResult,
  type Schedule,
  type ScheduleOptions,
  type SendOptions,
  type StopOptions,
  type UpdateQueueOptions,
  type WorkOptions,
} from "pg-boss";

import { databaseConfig } from "#api/platform/config/database.config";
import { jobConfig } from "#api/platform/config/job.config";
import type { Database } from "#api/platform/database/database.client";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { withJobScope } from "#api/platform/observability/sentry-scope";
import type {
  DeadLetterQueue,
  EnqueueJobOptions,
  EnqueueJobRequest,
  JobData,
  JobEnvelope,
  JobRuntimeHealth,
  JobRuntimePort,
  ScheduleJobOptions,
  WorkJobOptions,
} from "#api/shared/application/ports/job-runtime.port";
import {
  resolveDeadLetterJobPolicy,
  resolveDeadLetterQueue,
} from "#api/shared/application/ports/job-runtime.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { transactionJobDatabase } from "./drizzle-pg-boss.database.js";
import { jobKindOf, reportFailedJobAttempt } from "./jobs.alerts.js";
import { PgBossQueueProvisioner } from "./pg-boss-queue-provisioner.js";

export const PG_BOSS_CLIENT = Symbol("PG_BOSS_CLIENT");

/** health가 읽는 큐 수만 받는다. */
export type PgBossQueueCounts = Pick<
  QueueResult,
  "name" | "queuedCount" | "activeCount" | "failedCount"
>;

export interface PgBossClient {
  start(): Promise<unknown>;
  stop(options?: StopOptions): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
  createQueue(name: string, options?: QueueOptions): Promise<void>;
  updateQueue(name: string, options: UpdateQueueOptions): Promise<void>;
  send(name: string, data: object, options: SendOptions): Promise<string | null>;
  insert(name: string, jobs: JobInsert[], options: InsertOptions): Promise<string[] | null>;
  schedule(name: string, cron: string, data: object, options: ScheduleOptions): Promise<void>;
  unschedule(name: string, key?: string): Promise<void>;
  deleteJob(name: string, ids: string[], options?: { db?: Db }): Promise<unknown>;
  work(
    name: string,
    options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<JobData>[]) => Promise<unknown>,
  ): Promise<string>;
  getQueues(names?: string[]): Promise<PgBossQueueCounts[]>;
  getSchedules(): Promise<Schedule[]>;
  // pg-boss는 동기 계산이지만 지연 시작 client는 시작을 기다린 뒤 계산한다
  previewSchedule(cron: string, options: PreviewScheduleOptions): Date[] | Promise<Date[]>;
}

type PgBossClientLoader = () => PgBossClient | Promise<PgBossClient>;

export class LazyPgBossClient implements PgBossClient {
  #client?: PgBossClient;
  #starting?: Promise<PgBossClient>;
  readonly #errorListeners = new Set<(error: Error) => void>();
  #stopped = false;
  readonly #load: PgBossClientLoader;

  constructor(load: PgBossClientLoader) {
    this.#load = load;
  }

  async start(): Promise<unknown> {
    return this.#ensureStarted();
  }

  async stop(options?: StopOptions): Promise<void> {
    // 종료 뒤 늦게 도착한 enqueue가 새 pg-boss(풀·타이머)를 띄워 프로세스 종료를 막지 않게 한다
    this.#stopped = true;
    const client = this.#starting ? await this.#starting : this.#client;
    await client?.stop(options);
    this.#client = undefined;
    this.#starting = undefined;
  }

  on(event: "error", listener: (error: Error) => void): unknown {
    this.#errorListeners.add(listener);
    this.#client?.on(event, listener);
    return this;
  }

  async createQueue(name: string, options?: QueueOptions): Promise<void> {
    await (await this.#ensureStarted()).createQueue(name, options);
  }

  async updateQueue(name: string, options: UpdateQueueOptions): Promise<void> {
    await (await this.#ensureStarted()).updateQueue(name, options);
  }

  async send(name: string, data: object, options: SendOptions): Promise<string | null> {
    return (await this.#ensureStarted()).send(name, data, options);
  }

  async insert(name: string, jobs: JobInsert[], options: InsertOptions): Promise<string[] | null> {
    return (await this.#ensureStarted()).insert(name, jobs, options);
  }

  async schedule(
    name: string,
    cron: string,
    data: object,
    options: ScheduleOptions,
  ): Promise<void> {
    await (await this.#ensureStarted()).schedule(name, cron, data, options);
  }

  async unschedule(name: string, key?: string): Promise<void> {
    await (await this.#ensureStarted()).unschedule(name, key);
  }

  async deleteJob(name: string, ids: string[], options?: { db?: Db }): Promise<unknown> {
    return (await this.#ensureStarted()).deleteJob(name, ids, options);
  }

  async work(
    name: string,
    options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<JobData>[]) => Promise<unknown>,
  ): Promise<string> {
    return (await this.#ensureStarted()).work(name, options, handler);
  }

  async getQueues(names?: string[]): Promise<PgBossQueueCounts[]> {
    return (await this.#ensureStarted()).getQueues(names);
  }

  async getSchedules(): Promise<Schedule[]> {
    return (await this.#ensureStarted()).getSchedules();
  }

  async previewSchedule(cron: string, options: PreviewScheduleOptions): Promise<Date[]> {
    return (await this.#ensureStarted()).previewSchedule(cron, options);
  }

  async #ensureStarted(): Promise<PgBossClient> {
    if (this.#client) {
      return this.#client;
    }
    if (this.#stopped && !this.#starting) {
      throw new Error("pg-boss client is stopped");
    }

    this.#starting ??= this.#loadAndStart().catch((error: unknown) => {
      this.#starting = undefined;
      throw error;
    });
    return this.#starting;
  }

  async #loadAndStart(): Promise<PgBossClient> {
    const client = await this.#load();
    for (const listener of this.#errorListeners) {
      client.on("error", listener);
    }
    try {
      await client.start();
    } catch (startupError) {
      try {
        await client.stop({ graceful: false, close: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [startupError, cleanupError],
          "pg-boss startup and cleanup failed",
        );
      }
      throw startupError;
    }
    this.#client = client;
    return client;
  }
}

interface JobTransactionSource {
  readonly tx: Database;
}

export const pgBossClientProvider: FactoryProvider<PgBossClient> = {
  provide: PG_BOSS_CLIENT,
  inject: [databaseConfig.KEY, jobConfig.KEY],
  useFactory: (database: ConfigType<typeof databaseConfig>, job: ConfigType<typeof jobConfig>) => {
    // pg-boss는 이 설정을 pg Pool에 그대로 넘긴다. query_timeout은 pg-boss 타입에 없어 pg 타입으로 더한다
    const options: ConstructorOptions & Pick<PoolConfig, "query_timeout"> = {
      connectionString: database.url,
      schema: job.schema,
      application_name: "aido-pg-boss",
      max: 3,
      connectionTimeoutMillis: database.connectionTimeoutMs,
      query_timeout: database.queryTimeoutMs,
      migrate: false,
      createSchema: false,
      useListenNotify: false,
    };
    return new LazyPgBossClient(() => new PgBoss(options));
  },
};

@Injectable()
export class PgBossJobRuntimeAdapter implements JobRuntimePort {
  readonly #logger = new Logger(PgBossJobRuntimeAdapter.name);
  readonly #queues: PgBossQueueProvisioner;
  readonly #alerts: OperationalAlertPort | null;
  readonly #boss: PgBossClient;
  readonly #txHost: JobTransactionSource;
  readonly #config: Pick<ConfigType<typeof jobConfig>, "shutdownTimeoutMs">;

  constructor(
    @Inject(PG_BOSS_CLIENT) boss: PgBossClient,
    @Inject(TransactionHost)
    txHost: JobTransactionSource,
    @Inject(jobConfig.KEY)
    config: Pick<ConfigType<typeof jobConfig>, "shutdownTimeoutMs">,
    // 경보 모듈 없이 직접 조립하는 integration 테스트는 마지막 실패를 로그로만 남긴다
    @Optional() alerts?: OperationalAlertPort,
  ) {
    this.#boss = boss;
    this.#txHost = txHost;
    this.#config = config;
    this.#queues = new PgBossQueueProvisioner(boss);
    this.#alerts = alerts ?? null;
    this.#boss.on("error", (error) => {
      // 오류 종류만 기록한다. 작업 payload나 DB 연결 문자열은 로그에 남기지 않는다.
      this.#logger.error({
        event: PlatformLogEvent.JOB_RUNTIME_ERRORED,
        backend: "postgres",
        errorType: error.name,
      });
    });
  }

  async start(): Promise<void> {
    await this.#boss.start();
  }

  async stop(): Promise<void> {
    await this.#boss.stop({
      graceful: true,
      timeout: this.#config.shutdownTimeoutMs,
      close: true,
    });
  }

  async enqueue<T extends JobData>(
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<string | null> {
    const deadLetterQueue = resolveDeadLetterQueue(options.deadLetter);
    const deadLetterJobPolicy = resolveDeadLetterJobPolicy(options.deadLetter);
    if (deadLetterQueue) {
      await this.#queues.ensure(deadLetterQueue, deadLetterJobPolicy);
    }
    await this.#queues.ensure(queue);
    return this.#boss.send(queue, data, {
      ...toPgBossJobOptions(queue, options),
      db: transactionJobDatabase(this.#txHost.tx),
    });
  }

  async enqueueMany<T extends JobData>(
    queue: string,
    jobs: readonly EnqueueJobRequest<T>[],
  ): Promise<void> {
    if (jobs.length === 0) {
      return;
    }
    for (const deadLetter of uniqueDeadLetters(jobs)) {
      const deadLetterQueue = resolveDeadLetterQueue(deadLetter);
      if (deadLetterQueue) {
        await this.#queues.ensure(deadLetterQueue, resolveDeadLetterJobPolicy(deadLetter));
      }
    }
    await this.#queues.ensure(queue);
    // insert는 활성 CLS transaction에서 한 INSERT로 실행되고, 결정적 id 충돌은 send와 같이 무시된다.
    await this.#boss.insert(
      queue,
      jobs.map(({ data, options }) => ({ ...toPgBossJobOptions(queue, options), data })),
      { db: transactionJobDatabase(this.#txHost.tx) },
    );
  }

  async schedule<T extends JobData>(
    scheduleKey: string,
    cron: string,
    queue: string,
    data: T,
    options: ScheduleJobOptions,
  ): Promise<void> {
    const deadLetterQueue = resolveDeadLetterQueue(options.deadLetter);
    const deadLetterJobPolicy = resolveDeadLetterJobPolicy(options.deadLetter);
    if (deadLetterQueue) {
      await this.#queues.ensure(deadLetterQueue, deadLetterJobPolicy);
    }
    await this.#queues.ensure(queue);
    const {
      db: _transactionDb,
      singletonKey: _idempotencyKey,
      ...persistedOptions
    } = this.#toPgBossOptions(options, transactionJobDatabase(this.#txHost.tx));
    await this.#boss.schedule(queue, cron, data, {
      ...persistedOptions,
      key: scheduleKey,
      tz: options.timezone,
      ...(options.missed && { missed: options.missed }),
    });
  }

  async unschedule(scheduleKey: string, queue: string): Promise<void> {
    await this.#boss.unschedule(queue, scheduleKey);
  }

  async cancel(queue: string, idempotencyKeys: readonly string[]): Promise<void> {
    if (idempotencyKeys.length === 0) {
      return;
    }
    await this.#queues.ensure(queue);
    // pg-boss cancel은 행을 cancelled로 남겨 같은 결정적 id의 재등록이 ON CONFLICT로 무시된다.
    // 지우면 상태와 상관없이 id가 비어 재예약이 산다. 끝난 행은 보존 기록일 뿐이라 잃어도 된다.
    await this.#boss.deleteJob(
      queue,
      idempotencyKeys.map((key) => deterministicJobId(queue, key)),
      { db: transactionJobDatabase(this.#txHost.tx) },
    );
  }

  async work(
    queue: string,
    handler: (jobs: readonly JobEnvelope[]) => Promise<void>,
    options: WorkJobOptions,
  ): Promise<void> {
    await this.#queues.ensure(queue, options.queuePolicy);
    await this.#boss.work(
      queue,
      {
        includeMetadata: true,
        localConcurrency: options.teamSize,
        pollingIntervalSeconds: options.pollingIntervalSeconds,
      },
      async (jobs) => {
        const envelopes = jobs.map(({ id, name, data, retryCount }) => ({
          id,
          name,
          data,
          attempt: retryCount + 1,
        }));
        const [first] = envelopes;
        if (first == null) {
          return;
        }
        try {
          await withJobScope(
            {
              queue,
              jobName: first.name,
              jobId: first.id,
              attempt: first.attempt,
              batchSize: envelopes.length,
            },
            () => handler(envelopes),
          );
        } catch (error) {
          for (const job of jobs) {
            reportFailedJobAttempt(
              {
                queue,
                jobId: job.id,
                jobKind: jobKindOf(job.data),
                attempt: job.retryCount + 1,
                retryLimit: job.retryLimit,
                errorType: toErrorType(error),
              },
              { logger: this.#logger, alerts: this.#alerts },
            );
          }
          throw error;
        }
      },
    );
  }

  async health(queueNames: readonly string[]): Promise<JobRuntimeHealth> {
    try {
      const queues = await this.#boss.getQueues([...queueNames]);
      const byName = new Map(queues.map((queue) => [queue.name, queue]));

      return {
        backend: "postgres",
        degraded: false,
        queues: Object.fromEntries(
          queueNames.map((name) => {
            const queue = byName.get(name);
            return [
              name,
              {
                waiting: queue?.queuedCount ?? 0,
                active: queue?.activeCount ?? 0,
                failed: queue?.failedCount ?? 0,
                oldestAgeSeconds: null,
              },
            ];
          }),
        ),
      };
    } catch (error) {
      this.#logger.error({
        event: PlatformLogEvent.JOB_HEALTH_CHECK_FAILED,
        backend: "postgres",
        errorType: toErrorType(error),
      });
      return {
        backend: "postgres",
        degraded: true,
        reason: "job_runtime_unavailable",
        queues: Object.fromEntries(
          queueNames.map((name) => [
            name,
            {
              waiting: 0,
              active: 0,
              failed: 0,
              oldestAgeSeconds: null,
            },
          ]),
        ),
      };
    }
  }

  #toPgBossOptions(options: EnqueueJobOptions, db: Db): SendOptions {
    return {
      db,
      singletonKey: options.idempotencyKey,
      startAfter: options.startAfter,
      retryLimit: options.retryLimit,
      retryDelay: options.retryDelaySeconds,
      retryBackoff: options.retryBackoff,
      expireInSeconds: options.expireInSeconds,
      retentionSeconds: options.retentionSeconds,
      deleteAfterSeconds: options.deleteAfterSeconds,
      deadLetter: resolveDeadLetterQueue(options.deadLetter),
    };
  }
}

/** enqueue와 enqueueMany가 같은 재시도·DLQ·결정적 id 옵션으로 작업을 쓰도록 한 곳에서 변환한다. */
export function toPgBossJobOptions(
  queue: string,
  options: EnqueueJobOptions,
): Omit<JobInsert, "data"> {
  const { idempotencyKey } = options;
  return {
    singletonKey: idempotencyKey,
    startAfter: options.startAfter,
    retryLimit: options.retryLimit,
    retryDelay: options.retryDelaySeconds,
    retryBackoff: options.retryBackoff,
    expireInSeconds: options.expireInSeconds,
    retentionSeconds: options.retentionSeconds,
    deleteAfterSeconds: options.deleteAfterSeconds,
    deadLetter: resolveDeadLetterQueue(options.deadLetter),
    ...(idempotencyKey && { id: deterministicJobId(queue, idempotencyKey) }),
  };
}

function uniqueDeadLetters(jobs: readonly EnqueueJobRequest[]): DeadLetterQueue[] {
  const deadLetters = jobs.flatMap(({ options }) =>
    options.deadLetter == null ? [] : [options.deadLetter],
  );
  return uniqBy(deadLetters, (deadLetter) => resolveDeadLetterQueue(deadLetter));
}

export function deterministicJobId(queue: string, idempotencyKey: string): string {
  const bytes = Buffer.from(
    createHash("sha256").update(`${queue}:${idempotencyKey}`).digest().subarray(0, 16),
  );
  // 결정적 해시를 UUID version/variant 비트로 정규화해 pg-boss PK와 호환한다.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
