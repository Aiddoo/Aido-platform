import { type FactoryProvider, Inject, Injectable, Logger } from "@nestjs/common";
import { type JobState, type JobsOptions, Queue, Worker } from "bullmq";
import type Redis from "ioredis";

import type {
	EnqueueJobOptions,
	JobCancellationResult,
	JobData,
	JobRuntimeHealth,
	JobRuntimePort,
	JobRetryPolicy,
	WorkJobOptions,
} from "@/shared/application/ports/job-runtime.port";
import {
	resolveDeadLetterJobPolicy,
	resolveDeadLetterQueue,
	resolveJobIdempotencyKey,
} from "@/shared/application/ports/job-runtime.port";
import { withTimeout } from "@/shared/application/utils/with-timeout.util";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { REDIS_CLIENT } from "@/shared/infrastructure/redis";

export const BULLMQ_CLIENT_FACTORY = Symbol("BULLMQ_CLIENT_FACTORY");

export function legacyQueueName(queueName: string): string | null {
	return queueName.endsWith(".v1") ? queueName.slice(0, -3) : null;
}

export interface BullJobClient {
	readonly id?: string;
	readonly name: string;
	readonly data: object;
	readonly attemptsMade: number;
	readonly opts: { readonly attempts?: number };
	readonly timestamp: number;
}

export interface BullQueueClient {
	add(name: string, data: object, options: object): Promise<{ readonly id?: string }>;
	upsertJobScheduler(
		key: string,
		repeat: { readonly pattern: string; readonly tz?: string },
		template: {
			readonly name: string;
			readonly data: object;
			readonly opts: object;
		},
	): Promise<void>;
	removeJobScheduler(key: string): Promise<boolean>;
	getJob(id: string): Promise<
		| {
				getState(): Promise<JobState | "unknown">;
				remove(): Promise<void>;
		  }
		| undefined
	>;
	getCounts(): Promise<{
		readonly wait: number;
		readonly delayed: number;
		readonly active: number;
		readonly failed: number;
	}>;
	getOldestWaitingTimestamp(): Promise<number | null>;
	close(): Promise<void>;
}

export interface BullWorkerClient {
	onFailed(listener: (job: BullJobClient | undefined) => Promise<void>): void;
	close(force?: boolean): Promise<void>;
}

export interface BullMqClientFactory {
	createQueue(name: string): BullQueueClient;
	createWorker(
		name: string,
		processor: (job: BullJobClient) => Promise<void>,
		concurrency: number,
	): BullWorkerClient;
}

interface JobRuntimeConfigSource {
	readonly job: { readonly shutdownTimeoutMs: number };
}

interface RuntimePayload {
	readonly __aidoJobRuntime: 1;
	readonly data: JobData;
	readonly deadLetter?: string;
	readonly deadLetterJobPolicy?: JobRetryPolicy;
	readonly retryLimit: number;
	readonly retryDelaySeconds: number;
	readonly retryBackoff: boolean;
	readonly retentionSeconds: number;
	readonly deleteAfterSeconds: number;
}

class DefaultBullQueueClient implements BullQueueClient {
	constructor(private readonly queue: Queue<JobData>) {}

	async add(name: string, data: object, options: JobsOptions): Promise<{ readonly id?: string }> {
		return this.queue.add(name, data, options);
	}

	async upsertJobScheduler(
		key: string,
		repeat: { readonly pattern: string; readonly tz?: string },
		template: {
			readonly name: string;
			readonly data: object;
			readonly opts: JobsOptions;
		},
	): Promise<void> {
		await this.queue.upsertJobScheduler(key, repeat, template);
	}

	removeJobScheduler(key: string): Promise<boolean> {
		return this.queue.removeJobScheduler(key);
	}

	async getJob(id: string): Promise<
		| {
				getState(): Promise<JobState | "unknown">;
				remove(): Promise<void>;
		  }
		| undefined
	> {
		return (await this.queue.getJob(id)) ?? undefined;
	}

	async getCounts(): Promise<{
		readonly wait: number;
		readonly delayed: number;
		readonly active: number;
		readonly failed: number;
	}> {
		const counts = await this.queue.getJobCounts("wait", "delayed", "active", "failed");
		return {
			wait: counts.wait ?? 0,
			delayed: counts.delayed ?? 0,
			active: counts.active ?? 0,
			failed: counts.failed ?? 0,
		};
	}

	async getOldestWaitingTimestamp(): Promise<number | null> {
		const jobs = await this.queue.getJobs(["waiting", "delayed"], 0, 0, true);
		return jobs[0]?.timestamp ?? null;
	}

	async close(): Promise<void> {
		await this.queue.close();
	}
}

class DefaultBullWorkerClient implements BullWorkerClient {
	constructor(private readonly worker: Worker<JobData>) {}

	onFailed(listener: (job: BullJobClient | undefined) => Promise<void>): void {
		this.worker.on("failed", (job) => {
			void listener(job).catch(() => undefined);
		});
	}

	async close(force = false): Promise<void> {
		await this.worker.close(force);
	}
}

class DefaultBullMqClientFactory implements BullMqClientFactory {
	constructor(private readonly redis: Redis | null) {}

	private connection(): Redis {
		if (!this.redis) {
			throw new Error("Redis job runtime is disabled");
		}
		return this.redis;
	}

	createQueue(name: string): BullQueueClient {
		return new DefaultBullQueueClient(new Queue<JobData>(name, { connection: this.connection() }));
	}

	createWorker(
		name: string,
		processor: (job: BullJobClient) => Promise<void>,
		concurrency: number,
	): BullWorkerClient {
		return new DefaultBullWorkerClient(
			new Worker<JobData>(name, processor, {
				connection: this.connection(),
				concurrency,
			}),
		);
	}
}

export const bullMqClientFactoryProvider: FactoryProvider<BullMqClientFactory> = {
	provide: BULLMQ_CLIENT_FACTORY,
	inject: [REDIS_CLIENT],
	useFactory: (redis: Redis | null) => new DefaultBullMqClientFactory(redis),
};

@Injectable()
export class BullMqJobRuntimeAdapter implements JobRuntimePort {
	private readonly logger = new Logger(BullMqJobRuntimeAdapter.name);
	private readonly queues = new Map<string, BullQueueClient>();
	private readonly workers = new Map<string, BullWorkerClient>();

	constructor(
		@Inject(BULLMQ_CLIENT_FACTORY)
		private readonly factory: BullMqClientFactory,
		@Inject(TypedConfigService)
		private readonly config: JobRuntimeConfigSource,
	) {}

	async start(): Promise<void> {}

	async stop(): Promise<void> {
		await Promise.all(
			[...this.workers.entries()].map(async ([name, worker]) => {
				try {
					await withTimeout(
						worker.close(false),
						this.config.job.shutdownTimeoutMs,
						`BullMQ worker ${name} shutdown`,
					);
				} catch {
					this.logger.warn(`BullMQ worker ${name} forced to close`);
					await worker.close(true);
				}
			}),
		);

		await Promise.all([...this.queues.values()].map((queue) => queue.close()));
		this.workers.clear();
		this.queues.clear();
	}

	async enqueue<T extends JobData>(
		queueName: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<string | null> {
		const job = await this.queue(queueName).add(
			queueName,
			this.wrap(data, options),
			this.jobOptions(options),
		);
		return job.id ?? null;
	}

	async schedule<T extends JobData>(
		scheduleKey: string,
		cron: string,
		queueName: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<void> {
		const jobOptions = this.jobOptions(options);
		delete jobOptions.jobId;
		delete jobOptions.delay;
		await this.queue(queueName).upsertJobScheduler(
			scheduleKey,
			{ pattern: cron, tz: options.timezone },
			{
				name: queueName,
				data: this.wrap(data, options),
				opts: jobOptions,
			},
		);
		const legacyQueue = legacyQueueName(queueName);
		if (legacyQueue) {
			await this.queue(legacyQueue).removeJobScheduler(scheduleKey);
		}
	}

	async unschedule(scheduleKey: string, queueName: string): Promise<void> {
		await this.queue(queueName).removeJobScheduler(scheduleKey);
	}

	async cancel(queueName: string, idempotencyKey: string): Promise<JobCancellationResult> {
		const queue = this.queue(queueName);
		const jobId = toBullMqJobId(idempotencyKey);
		const job =
			(await queue.getJob(jobId)) ??
			(jobId === idempotencyKey ? undefined : await queue.getJob(idempotencyKey));
		if (!job) {
			return { status: "missing" };
		}

		const state = await job.getState();
		if (!isCancellableBullJobState(state)) {
			return { status: "missing" };
		}

		await job.remove();
		return { status: "cancelled" };
	}

	async work<T extends JobData>(
		queueName: string,
		handler: (
			jobs: readonly {
				readonly id: string;
				readonly name: string;
				readonly data: Readonly<T>;
				readonly attempt: number;
			}[],
		) => Promise<void>,
		options: WorkJobOptions,
	): Promise<void> {
		if (this.workers.has(queueName)) {
			return;
		}

		const worker = this.factory.createWorker(
			queueName,
			async (job) => {
				const payload = this.unwrap(job.data);
				await handler([
					{
						id: job.id ?? "unknown",
						name: job.name,
						data: payload.data as T,
						attempt: job.attemptsMade + 1,
					},
				]);
			},
			options.teamSize,
		);
		worker.onFailed(async (job) => {
			try {
				await this.moveToDeadLetter(job);
			} catch (error) {
				this.logger.error(
					`BullMQ dead-letter move failed (${error instanceof Error ? error.name : "UnknownError"})`,
				);
			}
		});
		this.workers.set(queueName, worker);
	}

	async health(queueNames: readonly string[]): Promise<JobRuntimeHealth> {
		try {
			const entries = await Promise.all(
				queueNames.map(async (name) => {
					const queue = this.queue(name);
					const [counts, oldestTimestamp] = await Promise.all([
						queue.getCounts(),
						queue.getOldestWaitingTimestamp(),
					]);
					return [
						name,
						{
							waiting: counts.wait + counts.delayed,
							active: counts.active,
							failed: counts.failed,
							oldestAgeSeconds:
								oldestTimestamp === null
									? null
									: Math.max(0, (Date.now() - oldestTimestamp) / 1000),
						},
					] as const;
				}),
			);
			return {
				backend: "redis",
				degraded: false,
				queues: Object.fromEntries(entries),
			};
		} catch (error) {
			this.logger.error(
				`BullMQ health check failed (${error instanceof Error ? error.name : "UnknownError"})`,
			);
			return {
				backend: "redis",
				degraded: true,
				reason: "job_runtime_unavailable",
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
	}

	private queue(name: string): BullQueueClient {
		const existing = this.queues.get(name);
		if (existing) {
			return existing;
		}

		const queue = this.factory.createQueue(name);
		this.queues.set(name, queue);
		return queue;
	}

	private jobOptions(options: EnqueueJobOptions): JobsOptions {
		const idempotencyKey = resolveJobIdempotencyKey(options);
		return {
			jobId: idempotencyKey ? toBullMqJobId(idempotencyKey) : undefined,
			delay: options.startAfter
				? Math.max(0, options.startAfter.getTime() - Date.now())
				: undefined,
			attempts: options.retryLimit + 1,
			backoff: {
				type: options.retryBackoff ? "exponential" : "fixed",
				delay: options.retryDelaySeconds * 1000,
			},
			removeOnComplete: { age: options.deleteAfterSeconds },
			removeOnFail: { age: options.retentionSeconds },
		};
	}

	private wrap<T extends JobData>(data: T, options: EnqueueJobOptions): RuntimePayload {
		return {
			__aidoJobRuntime: 1,
			data,
			deadLetter: resolveDeadLetterQueue(options.deadLetter),
			deadLetterJobPolicy: resolveDeadLetterJobPolicy(options.deadLetter),
			retryLimit: options.retryLimit,
			retryDelaySeconds: options.retryDelaySeconds,
			retryBackoff: options.retryBackoff,
			retentionSeconds: options.retentionSeconds,
			deleteAfterSeconds: options.deleteAfterSeconds,
		};
	}

	private unwrap(data: object): RuntimePayload {
		if (
			"__aidoJobRuntime" in data &&
			data.__aidoJobRuntime === 1 &&
			"data" in data &&
			typeof data.data === "object" &&
			data.data !== null
		) {
			return {
				__aidoJobRuntime: 1,
				data: data.data,
				deadLetter:
					"deadLetter" in data && typeof data.deadLetter === "string" ? data.deadLetter : undefined,
				deadLetterJobPolicy:
					"deadLetterJobPolicy" in data && isJobRetryPolicy(data.deadLetterJobPolicy)
						? data.deadLetterJobPolicy
						: undefined,
				retryLimit:
					"retryLimit" in data && typeof data.retryLimit === "number" ? data.retryLimit : 0,
				retryDelaySeconds:
					"retryDelaySeconds" in data && typeof data.retryDelaySeconds === "number"
						? data.retryDelaySeconds
						: 0,
				retryBackoff:
					"retryBackoff" in data && typeof data.retryBackoff === "boolean"
						? data.retryBackoff
						: false,
				retentionSeconds:
					"retentionSeconds" in data && typeof data.retentionSeconds === "number"
						? data.retentionSeconds
						: 14 * 24 * 60 * 60,
				deleteAfterSeconds:
					"deleteAfterSeconds" in data && typeof data.deleteAfterSeconds === "number"
						? data.deleteAfterSeconds
						: 7 * 24 * 60 * 60,
			};
		}

		return {
			__aidoJobRuntime: 1,
			data,
			retryLimit: 0,
			retryDelaySeconds: 0,
			retryBackoff: false,
			retentionSeconds: 14 * 24 * 60 * 60,
			deleteAfterSeconds: 7 * 24 * 60 * 60,
		};
	}

	private async moveToDeadLetter(job: BullJobClient | undefined): Promise<void> {
		if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
			return;
		}

		const payload = this.unwrap(job.data);
		if (!payload.deadLetter) {
			return;
		}

		const deadLetterJobPolicy = payload.deadLetterJobPolicy ?? {
			retryLimit: payload.retryLimit,
			retryDelaySeconds: payload.retryDelaySeconds,
			retryBackoff: payload.retryBackoff,
			expireInSeconds: 15 * 60,
			retentionSeconds: payload.retentionSeconds,
			deleteAfterSeconds: payload.deleteAfterSeconds,
		};
		await this.queue(payload.deadLetter).add(payload.deadLetter, payload.data, {
			jobId: toBullMqJobId(`${job.id ?? "unknown"}:dead-letter`),
			attempts: deadLetterJobPolicy.retryLimit + 1,
			backoff: {
				type: deadLetterJobPolicy.retryBackoff ? "exponential" : "fixed",
				delay: deadLetterJobPolicy.retryDelaySeconds * 1000,
			},
			removeOnComplete: { age: deadLetterJobPolicy.deleteAfterSeconds },
			removeOnFail: { age: deadLetterJobPolicy.retentionSeconds },
		});
	}
}

function isJobRetryPolicy(value: unknown): value is JobRetryPolicy {
	if (typeof value !== "object" || value === null) return false;
	return (
		"retryLimit" in value &&
		typeof value.retryLimit === "number" &&
		"retryDelaySeconds" in value &&
		typeof value.retryDelaySeconds === "number" &&
		"retryBackoff" in value &&
		typeof value.retryBackoff === "boolean" &&
		"expireInSeconds" in value &&
		typeof value.expireInSeconds === "number" &&
		"retentionSeconds" in value &&
		typeof value.retentionSeconds === "number" &&
		"deleteAfterSeconds" in value &&
		typeof value.deleteAfterSeconds === "number"
	);
}

/** BullMQ가 내부 key 구분자로 쓰는 colon을 충돌 없이 제거합니다. */
export function toBullMqJobId(idempotencyKey: string): string {
	return idempotencyKey.includes(":")
		? `aido_${Buffer.from(idempotencyKey, "utf8").toString("base64url")}`
		: idempotencyKey;
}

function isCancellableBullJobState(state: JobState | "unknown"): boolean {
	return (
		state === "waiting" ||
		state === "delayed" ||
		state === "prioritized" ||
		state === "waiting-children"
	);
}
