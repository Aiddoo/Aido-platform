import type { z } from "zod";

import type { DeadLetterQueue, JobEnvelope, JobRetryPolicy } from "./job-runtime.port.js";

// skip은 배포로 내려간 사이의 실행을 버리고, once는 놓친 실행 중 마지막 하나만 보낸다
type ScheduleMissedPolicy = "skip" | "once";

interface QueueSchedule<TPayload extends object> {
  readonly key: string;
  readonly cron: string;
  readonly timezone: string;
  readonly missed: ScheduleMissedPolicy;
  readonly payload: TPayload;
}

interface QueueWorkerOptions {
  readonly localConcurrency: number;
  readonly pollingIntervalSeconds: number;
  readonly batchSize?: number;
  // 묶음이 가득 차 돌아오는 동안 폴링을 기다리지 않고 바로 다음 묶음을 가져온다
  readonly burstWhenBatchFull?: boolean;
  // true면 묶음의 작업을 하나씩 handler에 넘겨 실패한 작업만 재시도한다. 멱등하지 않은 작업이 섞인 큐에 쓴다
  readonly isolateJobFailures?: boolean;
  readonly minPriority?: number;
  readonly maxPriority?: number;
}

export interface QueueDefinition<TPayload extends object> {
  readonly name: string;
  readonly payloadSchema: z.ZodType<TPayload>;
  readonly retry: JobRetryPolicy;
  readonly deadLetter?: DeadLetterQueue;
  readonly worker: QueueWorkerOptions;
  readonly schedules?: readonly QueueSchedule<TPayload>[];
}

export function defineQueue<TPayload extends object>(
  definition: QueueDefinition<TPayload>,
): QueueDefinition<TPayload> {
  return definition;
}

export interface EnqueueOptions {
  readonly idempotencyKey?: string;
  readonly startAfter?: Temporal.Instant;
  readonly priority?: number;
  readonly group?: string;
}

export interface EnqueueManyJob<TPayload extends object> {
  readonly payload: TPayload;
  readonly idempotencyKey?: string;
  readonly startAfter?: Temporal.Instant;
  readonly priority?: number;
}

/** 큐 하나의 정의(`defineQueue`)로 등록·소비·스케줄을 한다. 등록은 활성 UoW 트랜잭션에 함께 쓴다. */
export abstract class JobQueuePort {
  /** 같은 idempotencyKey의 작업이 이미 있으면 null이다. */
  abstract enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<string | null>;
  abstract enqueueMany<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    jobs: readonly EnqueueManyJob<TPayload>[],
  ): Promise<void>;
  /** 작업을 상태와 상관없이 지워 같은 key로 다시 등록할 수 있게 한다. 없는 key는 무시한다. */
  abstract cancel(
    queue: QueueDefinition<object>,
    idempotencyKeys: readonly string[],
  ): Promise<void>;
  /** payload를 정의의 schema로 parse해 넘긴다. 맞지 않는 작업은 handler에 오지 않고 실패한다. */
  abstract work<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<void>,
  ): Promise<void>;
  /** 정의의 schedules를 key별로 upsert한다. */
  abstract registerSchedules(queue: QueueDefinition<object>): Promise<void>;
}
