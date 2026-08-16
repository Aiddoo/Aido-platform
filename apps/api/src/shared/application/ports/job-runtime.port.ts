export type JobBackend = "postgres" | "redis";

export type JobData = object;

export interface JobEnvelope<T extends JobData = JobData> {
	readonly id: string;
	readonly name: string;
	readonly data: Readonly<T>;
	readonly attempt: number;
}

export interface EnqueueJobOptions {
	readonly jobKey?: string;
	readonly startAfter?: Date;
	readonly retryLimit: number;
	readonly retryDelaySeconds: number;
	readonly retryBackoff: boolean;
	readonly expireInSeconds: number;
	readonly retentionSeconds: number;
	readonly deleteAfterSeconds: number;
	readonly deadLetter?: string;
	readonly timezone?: string;
}

export interface WorkJobOptions {
	readonly teamSize: number;
	readonly pollingIntervalSeconds: number;
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
	cancel(queue: string, jobKey: string): Promise<JobCancellationResult>;
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
