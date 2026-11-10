import type {
  EnqueueJobOptions,
  EnqueueJobRequest,
  JobData,
  JobEnvelope,
  JobRuntimeHealth,
  JobRuntimePort,
  WorkJobOptions,
} from "#api/shared/application/ports/job-runtime.port";

export interface FakeEnqueueCall {
  readonly queue: string;
  readonly data: JobData;
  readonly options: EnqueueJobOptions;
}

export interface FakeScheduleCall extends FakeEnqueueCall {
  readonly scheduleKey: string;
  readonly cron: string;
}

type StoredHandler = (jobs: readonly JobEnvelope<JobData>[]) => Promise<void>;

export class FakeJobRuntime implements JobRuntimePort {
  readonly enqueueCalls: FakeEnqueueCall[] = [];
  readonly scheduleCalls: FakeScheduleCall[] = [];
  readonly unscheduleCalls: Array<{ scheduleKey: string; queue: string }> = [];
  readonly cancelCalls: Array<{ queue: string; idempotencyKey: string }> = [];
  readonly workCalls: Array<{ queue: string; options: WorkJobOptions }> = [];
  readonly #handlers = new Map<string, StoredHandler>();
  /** 실제 런타임처럼 지우기 전에는 같은 key를 다시 받지 않는다. */
  readonly #storedKeys = new Set<string>();
  #sequence = 0;

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async enqueue<T extends JobData>(
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<string | null> {
    const storedKey = options.idempotencyKey == null ? null : `${queue}:${options.idempotencyKey}`;
    if (storedKey != null) {
      if (this.#storedKeys.has(storedKey)) {
        return null;
      }
      this.#storedKeys.add(storedKey);
    }
    this.enqueueCalls.push({ queue, data, options });
    this.#sequence += 1;
    return `fake-job-${this.#sequence}`;
  }

  async enqueueMany<T extends JobData>(
    queue: string,
    jobs: readonly EnqueueJobRequest<T>[],
  ): Promise<void> {
    for (const { data, options } of jobs) {
      await this.enqueue(queue, data, options);
    }
  }

  async schedule<T extends JobData>(
    scheduleKey: string,
    cron: string,
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<void> {
    this.scheduleCalls.push({ scheduleKey, cron, queue, data, options });
  }

  async unschedule(scheduleKey: string, queue: string): Promise<void> {
    this.unscheduleCalls.push({ scheduleKey, queue });
  }

  async cancel(queue: string, idempotencyKeys: readonly string[]): Promise<void> {
    for (const idempotencyKey of idempotencyKeys) {
      this.#storedKeys.delete(`${queue}:${idempotencyKey}`);
      this.cancelCalls.push({ queue, idempotencyKey });
    }
  }

  async work(
    queue: string,
    handler: (jobs: readonly JobEnvelope[]) => Promise<void>,
    options: WorkJobOptions,
  ): Promise<void> {
    this.workCalls.push({ queue, options });
    this.#handlers.set(queue, handler);
  }

  async health(queueNames: readonly string[]): Promise<JobRuntimeHealth> {
    return {
      backend: "postgres",
      degraded: false,
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

  async run<T extends JobData>(queue: string, data: T, name = queue): Promise<void> {
    const handler = this.#handlers.get(queue);
    if (!handler) {
      throw new Error(`No fake job handler registered for ${queue}`);
    }
    this.#sequence += 1;
    await handler([
      {
        id: `fake-run-${this.#sequence}`,
        name,
        data,
        attempt: 1,
      },
    ]);
  }

  clear(): void {
    this.enqueueCalls.length = 0;
    this.scheduleCalls.length = 0;
    this.unscheduleCalls.length = 0;
    this.cancelCalls.length = 0;
    this.workCalls.length = 0;
    this.#storedKeys.clear();
    this.#sequence = 0;
  }
}
