type JobBackend = "postgres";

export type JobData = object;

export interface JobEnvelope<T extends JobData = JobData> {
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

export type DeadLetterQueue = string | DeadLetterQueuePolicy;

export interface EnqueueJobOptions extends JobRetryPolicy {
  readonly idempotencyKey?: string;
  readonly startAfter?: Date;
  /**
   * 문자열은 rolling 배포 중 기존 호출부와 payload를 위한 호환 계약입니다.
   * 신규 durable queue는 DLQ 자체의 재시도 정책까지 명시해야 합니다.
   */
  readonly deadLetter?: DeadLetterQueue;
  readonly timezone?: string;
}

// 옛 스케줄은 missed를 생략해 pg-boss 기본값(skip)을 쓴다. defineQueue로 옮기면 필수다
export interface ScheduleJobOptions extends EnqueueJobOptions {
  readonly missed?: "skip" | "once";
}

export interface EnqueueJobRequest<T extends JobData = JobData> {
  readonly data: T;
  readonly options: EnqueueJobOptions;
}

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

export interface WorkJobOptions {
  readonly teamSize: number;
  readonly pollingIntervalSeconds: number;
  /** pg-boss가 worker 등록 중 queue를 먼저 만들더라도 정책을 잃지 않게 합니다. */
  readonly queuePolicy?: JobRetryPolicy;
}

interface JobQueueHealth {
  readonly waiting: number;
  readonly active: number;
  readonly failed: number;
  readonly oldestAgeSeconds: number | null;
}

export interface JobRuntimeHealth {
  readonly backend: JobBackend;
  readonly degraded: boolean;
  readonly reason?: string;
  readonly queues: Readonly<Record<string, JobQueueHealth>>;
}

export abstract class JobRuntimePort {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract enqueue<T extends JobData>(
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<string | null>;
  /** 같은 큐의 작업을 한 번에 등록한다. 같은 idempotency key의 작업은 enqueue와 같이 한 번만 남는다. */
  abstract enqueueMany<T extends JobData>(
    queue: string,
    jobs: readonly EnqueueJobRequest<T>[],
  ): Promise<void>;
  abstract schedule<T extends JobData>(
    scheduleKey: string,
    cron: string,
    queue: string,
    data: T,
    options: ScheduleJobOptions,
  ): Promise<void>;
  abstract unschedule(scheduleKey: string, queue: string): Promise<void>;
  /** 작업을 상태와 상관없이 지워 같은 key로 다시 등록할 수 있게 한다. 없는 key는 무시한다. */
  abstract cancel(queue: string, idempotencyKeys: readonly string[]): Promise<void>;
  /** payload는 저장소에서 읽은 그대로라 handler가 자기 스키마로 검증한다. */
  abstract work(
    queue: string,
    handler: (jobs: readonly JobEnvelope[]) => Promise<void>,
    options: WorkJobOptions,
  ): Promise<void>;
  abstract health(queueNames: readonly string[]): Promise<JobRuntimeHealth>;
}

/**
 * 큐 폴링 주기.
 *
 * 폴링은 일이 없어도 도는 비용이다 — pg-boss는 주기마다 큐별로
 * `UPDATE ... FOR UPDATE SKIP LOCKED`를 날리므로, 유휴 상태에서도 WAL과 죽은 튜플이 쌓인다.
 * 그래서 주기는 "사람이 기다리고 있는가"로 정한다.
 */
export const JOB_POLLING_SECONDS = {
  /** 사람이 결과를 기다린다 — 푸시 발송처럼 늦으면 체감되는 일. */
  INTERACTIVE: 2,
  /** 정해진 시각에 도는 일 — 몇 초 늦어도 아무도 모른다. */
  SCHEDULED: 15,
  /** 배경에서 알아서 되는 일 — 지연이 의미를 갖지 않는다. */
  BACKGROUND: 30,
} as const;
