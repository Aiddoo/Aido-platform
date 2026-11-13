import {
  type EnqueueManyJob,
  type EnqueueOptions,
  type JobBatchFailures,
  type JobEnvelope,
  JobQueuePort,
  type JobQueueHealth,
  type JobRetryPolicy,
  type QueueDefinition,
} from "#api/shared/application/ports/job-queue.port";

// 운영 주기(polling 2~30초, backoff 재시도)를 실시간으로 기다리지 않게 pg-boss 최소 polling과 1초 고정 재시도를 쓴다. 운영 defineQueue 정의는 그대로 둔다
export const FAST_JOB_POLLING_SECONDS = 0.5;
const FAST_RETRY = { retryDelaySeconds: 1, retryBackoff: false } as const;
export const WORKER_WAIT = { timeout: 20_000, interval: 100 } as const;

function withFastRetry<TPolicy extends JobRetryPolicy>(policy: TPolicy): TPolicy {
  return { ...policy, ...FAST_RETRY };
}

export function withFastJobTiming<TPayload extends object>(
  queue: QueueDefinition<TPayload>,
): QueueDefinition<TPayload> {
  return {
    ...queue,
    retry: withFastRetry(queue.retry),
    worker: { ...queue.worker, pollingIntervalSeconds: FAST_JOB_POLLING_SECONDS },
  };
}

export class FastJobQueue extends JobQueuePort {
  readonly #queue: JobQueuePort;

  constructor(queue: JobQueuePort) {
    super();
    this.#queue = queue;
  }

  start(): Promise<void> {
    return this.#queue.start();
  }

  stop(): Promise<void> {
    return this.#queue.stop();
  }

  enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<string | null> {
    return this.#queue.enqueue(withFastJobTiming(queue), payload, options);
  }

  enqueueMany<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    jobs: readonly EnqueueManyJob<TPayload>[],
  ): Promise<void> {
    return this.#queue.enqueueMany(withFastJobTiming(queue), jobs);
  }

  cancel(queue: QueueDefinition<object>, idempotencyKeys: readonly string[]): Promise<void> {
    return this.#queue.cancel(queue, idempotencyKeys);
  }

  work<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<void> {
    return this.#queue.work(withFastJobTiming(queue), handler);
  }

  workBatch<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<JobBatchFailures>,
  ): Promise<void> {
    return this.#queue.workBatch(withFastJobTiming(queue), handler);
  }

  registerSchedules(queue: QueueDefinition<object>): Promise<void> {
    return this.#queue.registerSchedules(queue);
  }

  health(): Promise<JobQueueHealth> {
    return this.#queue.health();
  }
}
