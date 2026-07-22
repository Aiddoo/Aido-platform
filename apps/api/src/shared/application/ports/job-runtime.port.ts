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
	cancel(queue: string, jobKey: string): Promise<void>;
	work<T extends JobData>(
		queue: string,
		handler: (jobs: readonly JobEnvelope<T>[]) => Promise<void>,
		options: WorkJobOptions,
	): Promise<void>;
	health(queueNames: readonly string[]): Promise<JobRuntimeHealth>;
}

export const JOB_RUNTIME = Symbol("JOB_RUNTIME");
