import { createHash } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { JobInsert, JobResult, JobWithMetadata } from "pg-boss";

import { jobConfig } from "#api/platform/config/job.config";
import type { Database } from "#api/platform/database/database.client";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { withJobScope } from "#api/platform/observability/sentry-scope";
import {
  JobQueuePort,
  resolveDeadLetterJobPolicy,
  resolveDeadLetterQueue,
  type EnqueueManyJob,
  type EnqueueOptions,
  type JobEnvelope,
  type JobQueueHealth,
  type QueueDefinition,
} from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantToDate } from "#api/shared/domain/time/instant";

import { transactionJobDatabase } from "./drizzle-pg-boss.database.js";
import { JobQueueRegistry } from "./job-queue.registry.js";
import {
  INVALID_JOB_PAYLOAD_ERROR_TYPE,
  jobKindOf,
  reportFailedJobAttempt,
} from "./jobs.alerts.js";
import { PG_BOSS_CLIENT, type PgBossClient } from "./pg-boss-client.js";
import { PgBossQueueProvisioner } from "./pg-boss-queue-provisioner.js";

interface JobTransactionSource {
  readonly tx: Database;
}

interface JobTiming {
  readonly idempotencyKey?: string;
  readonly startAfter?: Temporal.Instant;
}

@Injectable()
export class PgBossJobQueueAdapter extends JobQueuePort {
  readonly #logger = new Logger(PgBossJobQueueAdapter.name);
  readonly #boss: PgBossClient;
  readonly #txHost: JobTransactionSource;
  readonly #registry: JobQueueRegistry;
  readonly #config: Pick<ConfigType<typeof jobConfig>, "shutdownTimeoutMs">;
  readonly #queues: PgBossQueueProvisioner;
  readonly #alerts: OperationalAlertPort | null;

  constructor(
    @Inject(PG_BOSS_CLIENT) boss: PgBossClient,
    @Inject(TransactionHost) txHost: JobTransactionSource,
    registry: JobQueueRegistry,
    @Inject(jobConfig.KEY) config: Pick<ConfigType<typeof jobConfig>, "shutdownTimeoutMs">,
    // 경보 모듈 없이 직접 조립하는 integration 테스트는 마지막 실패를 로그로만 남긴다
    @Optional() alerts?: OperationalAlertPort,
  ) {
    super();
    this.#boss = boss;
    this.#txHost = txHost;
    this.#registry = registry;
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

  async enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    await this.#ensure(queue);
    return this.#boss.send(queue.name, payload, {
      ...toPgBossJobOptions(queue, options),
      ...(options.priority != null && { priority: options.priority }),
      ...(options.group != null && { group: { id: options.group } }),
      db: transactionJobDatabase(this.#txHost.tx),
    });
  }

  async enqueueMany<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    jobs: readonly EnqueueManyJob<TPayload>[],
  ): Promise<void> {
    if (jobs.length === 0) {
      return;
    }
    await this.#ensure(queue);
    // 활성 CLS 트랜잭션에서 한 INSERT로 쓰고, 결정적 id 충돌은 enqueue와 같이 무시된다
    await this.#boss.insert(
      queue.name,
      jobs.map((job) => ({
        ...toPgBossJobOptions(queue, job),
        ...(job.priority != null && { priority: job.priority }),
        data: job.payload,
      })),
      { db: transactionJobDatabase(this.#txHost.tx) },
    );
  }

  async cancel(queue: QueueDefinition<object>, idempotencyKeys: readonly string[]): Promise<void> {
    if (idempotencyKeys.length === 0) {
      return;
    }
    await this.#ensure(queue);
    // pg-boss cancel은 행을 cancelled로 남겨 같은 결정적 id의 재등록이 ON CONFLICT로 무시된다.
    // 지우면 상태와 상관없이 id가 비어 재예약이 산다. 끝난 행은 보존 기록일 뿐이라 잃어도 된다.
    await this.#boss.deleteJob(
      queue.name,
      idempotencyKeys.map((key) => deterministicJobId(queue.name, key)),
      { db: transactionJobDatabase(this.#txHost.tx) },
    );
  }

  async work<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<void> {
    await this.#ensure(queue);
    const { worker } = queue;
    await this.#boss.work(
      queue.name,
      {
        includeMetadata: true,
        // 묶음 안의 잘못된 payload 하나가 나머지 작업까지 재시도시키지 않게 작업별로 결과를 돌려준다
        perJobResults: true,
        localConcurrency: worker.localConcurrency,
        pollingIntervalSeconds: worker.pollingIntervalSeconds,
        ...(worker.batchSize != null && { batchSize: worker.batchSize }),
        ...(worker.burstWhenBatchFull != null && {
          burstWhenBatchFull: worker.burstWhenBatchFull,
        }),
        ...(worker.minPriority != null && { minPriority: worker.minPriority }),
        ...(worker.maxPriority != null && { maxPriority: worker.maxPriority }),
      },
      async (jobs) => this.#handle(queue, jobs, handler),
    );
  }

  async registerSchedules(queue: QueueDefinition<object>): Promise<void> {
    await this.#ensure(queue);
    for (const schedule of queue.schedules ?? []) {
      const {
        singletonKey: _idempotencyKey,
        id: _jobId,
        ...persistedOptions
      } = toPgBossJobOptions(queue, {});
      await this.#boss.schedule(queue.name, schedule.cron, schedule.payload, {
        ...persistedOptions,
        key: schedule.key,
        tz: schedule.timezone,
        missed: schedule.missed,
      });
    }
  }

  async health(): Promise<JobQueueHealth> {
    const queueNames = this.#registry.queueNames();
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
            { waiting: 0, active: 0, failed: 0, oldestAgeSeconds: null },
          ]),
        ),
      };
    }
  }

  async #handle<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    jobs: readonly JobWithMetadata<object>[],
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<JobResult[]> {
    const accepted: JobEnvelope<TPayload>[] = [];
    const results: JobResult[] = [];
    for (const job of jobs) {
      const parsed = queue.payloadSchema.safeParse(job.data);
      if (!parsed.success) {
        // payload 값은 개인정보가 섞일 수 있어 잘못된 경로만 남긴다
        this.#logger.error({
          event: PlatformLogEvent.JOB_PAYLOAD_INVALID,
          queue: queue.name,
          jobId: job.id,
          paths: parsed.error.issues.map((issue) => issue.path.join(".")),
        });
        this.#reportFailure(queue, job, INVALID_JOB_PAYLOAD_ERROR_TYPE);
        results.push({ id: job.id, status: "failed", output: { reason: "invalid_payload" } });
        continue;
      }
      accepted.push({
        id: job.id,
        name: job.name,
        data: parsed.data,
        attempt: job.retryCount + 1,
      });
    }

    const [first] = accepted;
    if (first == null) {
      return results;
    }
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const reportFailure = (envelope: JobEnvelope<TPayload>, error: unknown): void => {
      const job = jobsById.get(envelope.id);
      if (job != null) {
        this.#reportFailure(queue, job, toErrorType(error));
      }
    };
    const scope = {
      queue: queue.name,
      jobName: first.name,
      jobId: first.id,
      attempt: first.attempt,
      batchSize: accepted.length,
    };
    if (queue.worker.isolateJobFailures === true) {
      return [
        ...results,
        ...(await withJobScope(scope, () => settleEachJob(accepted, handler, reportFailure))),
      ];
    }
    try {
      await withJobScope(scope, () => handler(accepted));
    } catch (error) {
      for (const envelope of accepted) {
        reportFailure(envelope, error);
      }
      throw error;
    }
    return [...results, ...accepted.map(({ id }) => ({ id, status: "completed" as const }))];
  }

  #reportFailure(
    queue: QueueDefinition<object>,
    job: JobWithMetadata<object>,
    errorType: string,
  ): void {
    reportFailedJobAttempt(
      {
        queue: queue.name,
        jobId: job.id,
        jobKind: jobKindOf(job.data),
        attempt: job.retryCount + 1,
        retryLimit: job.retryLimit,
        errorType,
      },
      { logger: this.#logger, alerts: this.#alerts },
    );
  }

  async #ensure(queue: QueueDefinition<object>): Promise<void> {
    this.#registry.register(queue);
    const deadLetterQueue = resolveDeadLetterQueue(queue.deadLetter);
    if (deadLetterQueue != null) {
      await this.#queues.ensure(deadLetterQueue, resolveDeadLetterJobPolicy(queue.deadLetter));
    }
    await this.#queues.ensure(queue.name, queue.retry);
  }
}

async function settleEachJob<TPayload extends object>(
  jobs: readonly JobEnvelope<TPayload>[],
  handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  onFailure: (job: JobEnvelope<TPayload>, error: unknown) => void,
): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (const job of jobs) {
    try {
      await handler([job]);
      results.push({ id: job.id, status: "completed" });
    } catch (error) {
      onFailure(job, error);
      // pg-boss가 handler throw를 기록할 때와 같이 오류 객체를 실패 출력으로 남긴다
      results.push({ id: job.id, status: "failed", output: error });
    }
  }
  return results;
}

/** enqueue·enqueueMany·스케줄이 같은 재시도·DLQ·결정적 id 옵션으로 작업을 쓰도록 한 곳에서 변환한다. */
function toPgBossJobOptions(
  queue: QueueDefinition<object>,
  timing: JobTiming,
): Omit<JobInsert, "data"> {
  const { idempotencyKey } = timing;
  return {
    singletonKey: idempotencyKey,
    startAfter: timing.startAfter == null ? undefined : instantToDate(timing.startAfter),
    retryLimit: queue.retry.retryLimit,
    retryDelay: queue.retry.retryDelaySeconds,
    retryBackoff: queue.retry.retryBackoff,
    expireInSeconds: queue.retry.expireInSeconds,
    retentionSeconds: queue.retry.retentionSeconds,
    deleteAfterSeconds: queue.retry.deleteAfterSeconds,
    deadLetter: resolveDeadLetterQueue(queue.deadLetter),
    ...(idempotencyKey && { id: deterministicJobId(queue.name, idempotencyKey) }),
  };
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
