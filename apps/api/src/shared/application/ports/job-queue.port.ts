import type { z } from "zod";

export interface JobEnvelope<T extends object = object> {
  readonly id: string;
  readonly name: string;
  readonly data: Readonly<T>;
  readonly attempt: number;
}

export interface JobRetryPolicy {
  readonly retryLimit: number;
  readonly retryDelaySeconds: number;
  readonly retryBackoff: boolean;
  readonly expireInSeconds: number;
  readonly retentionSeconds: number;
  readonly deleteAfterSeconds: number;
}

interface DeadLetterQueuePolicy {
  readonly queue: string;
  readonly jobPolicy: JobRetryPolicy;
}

// 문자열은 DLQ 자체 정책 없이 이름만 넘기던 옛 정의와 쌓인 작업을 위한 모양이다
export type DeadLetterQueue = string | DeadLetterQueuePolicy;

export function resolveDeadLetterQueue(
  deadLetter: DeadLetterQueue | undefined,
): string | undefined {
  return typeof deadLetter === "string" ? deadLetter : deadLetter?.queue;
}

export function resolveDeadLetterJobPolicy(
  deadLetter: DeadLetterQueue | undefined,
): JobRetryPolicy | undefined {
  return typeof deadLetter === "object" ? deadLetter.jobPolicy : undefined;
}

/** 큐 폴링 주기. 폴링은 일이 없어도 큐 저장소에 조회가 나가는 비용이라 "사람이 기다리고 있는가"로 정한다. */
export const JOB_POLLING_SECONDS = {
  /** 사람이 결과를 기다린다 — 푸시 발송처럼 늦으면 체감되는 일. */
  INTERACTIVE: 2,
  /** 정해진 시각에 도는 일 — 몇 초 늦어도 아무도 모른다. */
  SCHEDULED: 15,
  /** 배경에서 알아서 되는 일 — 지연이 의미를 갖지 않는다. */
  BACKGROUND: 30,
} as const;

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

interface QueueHealth {
  readonly waiting: number;
  readonly active: number;
  readonly failed: number;
  readonly oldestAgeSeconds: number | null;
}

export interface JobQueueHealth {
  readonly backend: string;
  readonly degraded: boolean;
  readonly reason?: string;
  readonly queues: Readonly<Record<string, QueueHealth>>;
}

/** 묶음 handler가 실패로 끝낸 작업(id → 오류). 여기 없는 작업은 완료다 */
export type JobBatchFailures = ReadonlyMap<string, unknown>;

/** 큐 하나의 정의(`defineQueue`)로 등록·소비·스케줄을 한다. 등록은 활성 UoW 트랜잭션에 함께 쓴다. */
export abstract class JobQueuePort {
  abstract start(): Promise<void>;
  /** 처리 중인 작업이 끝나기를 기다린 뒤 연결을 닫는다. */
  abstract stop(): Promise<void>;
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
  /**
   * 묶음을 한 번에 넘겨 조회·발행을 묶게 하고, handler가 돌려준 작업만 실패로 재시도한다.
   * handler가 던지면 묶음 전체가 실패한다. 작업마다 끝내야 하는 큐가 작업당 조회를 줄일 때 쓴다
   */
  abstract workBatch<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    handler: (jobs: readonly JobEnvelope<TPayload>[]) => Promise<JobBatchFailures>,
  ): Promise<void>;
  /** 정의의 schedules를 key별로 upsert한다. */
  abstract registerSchedules(queue: QueueDefinition<object>): Promise<void>;
  /** 이 프로세스가 정의로 쓴 큐와 그 DLQ의 상태. 저장소 장애는 throw하지 않고 degraded로 돌려준다. */
  abstract health(): Promise<JobQueueHealth>;
}
