export type JobBackend = "postgres" | "redis";

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

export interface DeadLetterQueuePolicy {
	readonly queue: string;
	readonly jobPolicy: JobRetryPolicy;
}

export type DeadLetterQueue = string | DeadLetterQueuePolicy;

interface BaseEnqueueJobOptions extends JobRetryPolicy {
	readonly startAfter?: Date;
	/**
	 * 문자열은 rolling 배포 중 기존 호출부와 payload를 위한 호환 계약입니다.
	 * 신규 durable queue는 DLQ 자체의 재시도 정책까지 명시해야 합니다.
	 */
	readonly deadLetter?: DeadLetterQueue;
	readonly timezone?: string;
}

type JobIdempotencyOptions =
	| {
			readonly idempotencyKey: string;
			readonly jobKey?: never;
	  }
	| {
			readonly idempotencyKey?: never;
			/** @deprecated `idempotencyKey`를 사용하세요. */
			readonly jobKey: string;
	  }
	| {
			readonly idempotencyKey?: undefined;
			readonly jobKey?: undefined;
	  };

export type EnqueueJobOptions = BaseEnqueueJobOptions & JobIdempotencyOptions;

/** rolling 배포 중 신규·레거시 이름을 하나의 런타임 값으로 정규화합니다. */
export function resolveJobIdempotencyKey(options: EnqueueJobOptions): string | undefined {
	return options.idempotencyKey ?? options.jobKey;
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

export interface JobQueueHealth {
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

export type JobCancellationResult =
	| { readonly status: "cancelled" }
	| { readonly status: "missing" };

export interface JobRuntimePort {
	start(): Promise<void>;
	stop(): Promise<void>;
	enqueue<T extends JobData>(
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<string | null>;
	schedule<T extends JobData>(
		scheduleKey: string,
		cron: string,
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<void>;
	unschedule(scheduleKey: string, queue: string): Promise<void>;
	cancel(queue: string, idempotencyKey: string): Promise<JobCancellationResult>;
	work<T extends JobData>(
		queue: string,
		handler: (jobs: readonly JobEnvelope<T>[]) => Promise<void>,
		options: WorkJobOptions,
	): Promise<void>;
	health(queueNames: readonly string[]): Promise<JobRuntimeHealth>;
}

export const JOB_RUNTIME = Symbol("JOB_RUNTIME");

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
