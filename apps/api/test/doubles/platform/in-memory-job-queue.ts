import {
  JobQueuePort,
  type EnqueueManyJob,
  type EnqueueOptions,
  type JobBatchFailures,
  type JobEnvelope,
  type JobQueueHealth,
  type QueueDefinition,
} from "#api/shared/application/ports/job-queue.port";

export interface InMemoryJob {
  readonly queue: string;
  readonly payload: object;
  readonly options: EnqueueOptions;
}

type StoredHandler = (jobs: readonly JobEnvelope<object>[]) => Promise<void>;

interface StoredWorker {
  readonly queue: QueueDefinition<object>;
  readonly handler: StoredHandler;
}

// 실제 큐처럼 같은 key는 지우기 전까지 한 번만 받고, run은 소비 때와 같이 schema로 parse한다
export class InMemoryJobQueue extends JobQueuePort {
  readonly jobs: InMemoryJob[] = [];
  readonly scheduledQueues: string[] = [];
  readonly #keys = new Set<string>();
  readonly #workers = new Map<string, StoredWorker>();
  readonly #queueNames = new Set<string>();
  #sequence = 0;
  running = false;

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    this.#queueNames.add(queue.name);
    if (options.idempotencyKey != null) {
      const key = `${queue.name}:${options.idempotencyKey}`;
      if (this.#keys.has(key)) {
        return null;
      }
      this.#keys.add(key);
    }
    this.jobs.push({ queue: queue.name, payload, options });
    this.#sequence += 1;
    return `in-memory-job-${this.#sequence}`;
  }

  async enqueueMany<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    jobs: readonly EnqueueManyJob<TPayload>[],
  ): Promise<void> {
    for (const { payload, ...options } of jobs) {
      await this.enqueue(queue, payload, options);
    }
  }

  async cancel(queue: QueueDefinition<object>, idempotencyKeys: readonly string[]): Promise<void> {
    for (const idempotencyKey of idempotencyKeys) {
      this.#keys.delete(`${queue.name}:${idempotencyKey}`);
      const index = this.jobs.findIndex(
        (job) => job.queue === queue.name && job.options.idempotencyKey === idempotencyKey,
      );
      if (index !== -1) {
        this.jobs.splice(index, 1);
      }
    }
  }

  async work<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<void> {
    this.#queueNames.add(queue.name);
    this.#workers.set(queue.name, {
      queue,
      handler: async (jobs) =>
        handler(jobs.map((job) => ({ ...job, data: queue.payloadSchema.parse(job.data) }))),
    });
  }

  async workBatch<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<JobBatchFailures>,
  ): Promise<void> {
    // drain은 작업을 하나씩 넘기므로 그 작업의 실패를 던져 work와 같이 보이게 한다
    await this.work(queue, async (jobs) => {
      const failures = await handler(jobs);
      const [failure] = failures.values();
      if (failures.size > 0) {
        throw failure;
      }
    });
  }

  async registerSchedules(queue: QueueDefinition<object>): Promise<void> {
    this.#queueNames.add(queue.name);
    this.scheduledQueues.push(queue.name);
  }

  async health(): Promise<JobQueueHealth> {
    return {
      backend: "postgres",
      degraded: false,
      queues: Object.fromEntries(
        [...this.#queueNames].map((name) => [
          name,
          {
            waiting: this.jobs.filter((job) => job.queue === name).length,
            active: 0,
            failed: 0,
            oldestAgeSeconds: null,
          },
        ]),
      ),
    };
  }

  /** 쌓인 작업과 멱등 key를 비운다. 등록된 worker는 남긴다(E2E가 테스트마다 정리할 때 쓴다). */
  clear(): void {
    this.jobs.length = 0;
    this.#keys.clear();
  }

  jobsIn(queue: QueueDefinition<object>): readonly InMemoryJob[] {
    return this.jobs.filter((job) => job.queue === queue.name);
  }

  /** 쌓인 작업을 등록된 worker로 처리하고 큐에서 뺀다. */
  async drain(queue: QueueDefinition<object>): Promise<void> {
    const worker = this.#workers.get(queue.name);
    if (worker == null) {
      throw new Error(`No in-memory worker registered for ${queue.name}`);
    }
    const pending = this.jobsIn(queue);
    for (const job of pending) {
      this.jobs.splice(this.jobs.indexOf(job), 1);
      this.#sequence += 1;
      await worker.handler([
        { id: `in-memory-run-${this.#sequence}`, name: queue.name, data: job.payload, attempt: 1 },
      ]);
    }
  }
}
