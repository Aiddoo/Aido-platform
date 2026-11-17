import type { FactoryProvider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { PoolConfig } from "pg";
import {
  PgBoss,
  type ConstructorOptions,
  type Db,
  type InsertOptions,
  type JobInsert,
  type JobWithMetadata,
  type PreviewScheduleOptions,
  type Queue,
  type QueueResult,
  type Schedule,
  type ScheduleOptions,
  type SendOptions,
  type StopOptions,
  type UpdateQueueOptions,
  type Warning,
  type WorkOptions,
} from "pg-boss";

import { databaseConfig } from "#api/platform/config/database.config";
import { jobConfig } from "#api/platform/config/job.config";
import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";

// 업무 포트가 아니라 pg-boss 클라이언트 인스턴스라 Symbol 토큰으로 둔다(platform/jobs 어댑터만 주입받는다)
export const PG_BOSS_CLIENT = Symbol("PG_BOSS_CLIENT");

/** health가 읽는 큐 수만 받는다. */
export type PgBossQueueCounts = Pick<
  QueueResult,
  "name" | "queuedCount" | "activeCount" | "failedCount"
>;

// pg-boss 유지보수(큐 통계 집계·만료 정리)와 스케줄 감시 집계는 job 표를 넓게 읽어 앱 풀 상한(15초)을 넘을 수 있다.
// pg-boss 느린 쿼리 경고(30초)보다 길게 둔다
const PG_BOSS_STATEMENT_TIMEOUT_MS = 60_000;
// 평소에는 서버 statement_timeout이 먼저 취소하고 DB가 응답하지 않을 때만 클라이언트가 끊는다
const PG_BOSS_QUERY_TIMEOUT_MS = PG_BOSS_STATEMENT_TIMEOUT_MS + 5000;

export type PgBossQueueOptions = Omit<Queue, "name">;

export type PgBossListener =
  | readonly [event: "error", listener: (error: Error) => void]
  | readonly [event: "warning", listener: (warning: Warning) => void];

export interface PgBossClient {
  start(): Promise<unknown>;
  stop(options?: StopOptions): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "warning", listener: (warning: Warning) => void): unknown;
  createQueue(name: string, options?: PgBossQueueOptions): Promise<void>;
  updateQueue(name: string, options: UpdateQueueOptions): Promise<void>;
  send(name: string, data: object, options: SendOptions): Promise<string | null>;
  insert(name: string, jobs: JobInsert[], options: InsertOptions): Promise<string[] | null>;
  schedule(name: string, cron: string, data: object, options: ScheduleOptions): Promise<void>;
  unschedule(name: string, key?: string): Promise<void>;
  deleteJob(name: string, ids: string[], options?: { db?: Db }): Promise<unknown>;
  getJobById(name: string, id: string, options?: { db?: Db }): Promise<JobWithMetadata | null>;
  work(
    name: string,
    options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<object>[]) => Promise<unknown>,
  ): Promise<string>;
  getQueues(names?: string[]): Promise<PgBossQueueCounts[]>;
  getSchedules(): Promise<Schedule[]>;
  // pg-boss는 동기 계산이지만 지연 시작 client는 시작을 기다린 뒤 계산한다
  previewSchedule(cron: string, options: PreviewScheduleOptions): Date[] | Promise<Date[]>;
  // pg-boss 풀에서 쿼리를 돌린다. 지연 시작 client는 시작을 기다린 뒤 준다
  getDb(): Db | Promise<Db>;
}

function attachListener(client: PgBossClient, registration: PgBossListener): void {
  if (registration[0] === "error") {
    client.on(registration[0], registration[1]);
    return;
  }
  client.on(registration[0], registration[1]);
}

type PgBossClientLoader = () => PgBossClient | Promise<PgBossClient>;

export class LazyPgBossClient implements PgBossClient {
  #client?: PgBossClient;
  #starting?: Promise<PgBossClient>;
  readonly #listeners = new Set<PgBossListener>();
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

  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "warning", listener: (warning: Warning) => void): unknown;
  on(...registration: PgBossListener): unknown {
    this.#listeners.add(registration);
    if (this.#client) {
      attachListener(this.#client, registration);
    }
    return this;
  }

  async createQueue(name: string, options?: PgBossQueueOptions): Promise<void> {
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

  async getJobById(
    name: string,
    id: string,
    options?: { db?: Db },
  ): Promise<JobWithMetadata | null> {
    return (await this.#ensureStarted()).getJobById(name, id, options);
  }

  async work(
    name: string,
    options: WorkOptions & { includeMetadata: true },
    handler: (jobs: JobWithMetadata<object>[]) => Promise<unknown>,
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

  async getDb(): Promise<Db> {
    return (await this.#ensureStarted()).getDb();
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
    for (const registration of this.#listeners) {
      attachListener(client, registration);
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

export const pgBossClientProvider: FactoryProvider<PgBossClient> = {
  provide: PG_BOSS_CLIENT,
  inject: [databaseConfig.KEY, jobConfig.KEY],
  useFactory: (database: ConfigType<typeof databaseConfig>, job: ConfigType<typeof jobConfig>) => {
    // pg-boss가 이 설정을 pg Pool에 그대로 넘겨 앱 풀과 같은 TLS·유휴 정리를 쓴다(pg 전용 칸은 PoolConfig 타입으로 받는다)
    const options: ConstructorOptions & PoolConfig = {
      ...createPostgresPoolConfig(database.url, {
        applicationName: "aido-pg-boss",
        max: job.poolMax,
        idleTimeoutMs: database.idleTimeoutMs,
        connectionTimeoutMs: database.connectionTimeoutMs,
        queryTimeoutMs: PG_BOSS_QUERY_TIMEOUT_MS,
        statementTimeoutMs: PG_BOSS_STATEMENT_TIMEOUT_MS,
        allowUnverifiedTls: database.allowUnverifiedTls,
      }),
      schema: job.schema,
      migrate: false,
      createSchema: false,
      useListenNotify: false,
      // 정기 작업 발행과 큐 유지보수는 worker를 돌리는 프로세스만 한다
      schedule: job.workerEnabled,
      supervise: job.workerEnabled,
    };
    return new LazyPgBossClient(() => new PgBoss(options));
  },
};
