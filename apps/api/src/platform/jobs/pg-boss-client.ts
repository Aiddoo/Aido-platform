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

// pg-boss 인스턴스는 라이브러리 객체라 포트 클래스가 없어 Symbol 토큰으로 주입한다
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
    handler: (jobs: JobWithMetadata<object>[]) => Promise<unknown>,
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
