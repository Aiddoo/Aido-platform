import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { JobResult, JobWithMetadata } from "pg-boss";

import type { Database } from "#api/platform/database/database.client";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import {
  JobQueuePort,
  resolveDeadLetterJobPolicy,
  resolveDeadLetterQueue,
  type EnqueueJobOptions,
  type EnqueueManyJob,
  type EnqueueOptions,
  type JobEnvelope,
  type QueueDefinition,
} from "#api/shared/application/ports/index";
import { instantToDate } from "#api/shared/domain/time/instant";

import { transactionJobDatabase } from "./drizzle-pg-boss.database.js";
import { JobQueueRegistry } from "./job-queue.registry.js";
import {
  deterministicJobId,
  PG_BOSS_CLIENT,
  toPgBossJobOptions,
  type PgBossClient,
} from "./pg-boss-job-runtime.adapter.js";
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
  readonly #queues: PgBossQueueProvisioner;

  constructor(
    @Inject(PG_BOSS_CLIENT) boss: PgBossClient,
    @Inject(TransactionHost) txHost: JobTransactionSource,
    registry: JobQueueRegistry,
  ) {
    super();
    this.#boss = boss;
    this.#txHost = txHost;
    this.#registry = registry;
    this.#queues = new PgBossQueueProvisioner(boss);
  }

  async enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    await this.#ensure(queue);
    return this.#boss.send(queue.name, payload, {
      ...toPgBossJobOptions(queue.name, toEnqueueJobOptions(queue, options)),
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
    await this.#boss.insert(
      queue.name,
      jobs.map((job) => ({
        ...toPgBossJobOptions(queue.name, toEnqueueJobOptions(queue, job)),
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
      } = toPgBossJobOptions(queue.name, toEnqueueJobOptions(queue, {}));
      await this.#boss.schedule(queue.name, schedule.cron, schedule.payload, {
        ...persistedOptions,
        key: schedule.key,
        tz: schedule.timezone,
        missed: schedule.missed,
      });
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

    if (accepted.length > 0) {
      await handler(accepted);
    }
    return [...results, ...accepted.map(({ id }) => ({ id, status: "completed" as const }))];
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

function toEnqueueJobOptions(queue: QueueDefinition<object>, timing: JobTiming): EnqueueJobOptions {
  return {
    ...queue.retry,
    deadLetter: queue.deadLetter,
    ...(timing.idempotencyKey != null && { idempotencyKey: timing.idempotencyKey }),
    ...(timing.startAfter != null && { startAfter: instantToDate(timing.startAfter) }),
  };
}
