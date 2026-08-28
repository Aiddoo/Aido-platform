import { createHash } from "node:crypto";

import { TransactionHost } from "@nestjs-cls/transactional";
import { type FactoryProvider, Inject, Injectable, Logger } from "@nestjs/common";
import type {
	Db,
	FindJobsOptions,
	JobWithMetadata,
	PrismaTransactionLike,
	QueueResult,
	QueueOptions,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	UpdateQueueOptions,
	WorkOptions,
} from "pg-boss";

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
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

export const PG_BOSS_CLIENT = Symbol("PG_BOSS_CLIENT");

export interface PgBossClient {
	start(): Promise<unknown>;
	stop(options?: StopOptions): Promise<void>;
	on(event: "error", listener: (error: Error) => void): unknown;
	createQueue(name: string, options?: QueueOptions): Promise<void>;
	updateQueue(name: string, options: UpdateQueueOptions): Promise<void>;
	send(name: string, data: object, options: SendOptions): Promise<string | null>;
	schedule(name: string, cron: string, data: object, options: ScheduleOptions): Promise<void>;
	unschedule(name: string, key?: string): Promise<void>;
	findJobs<T extends JobData>(
		name: string,
		options?: FindJobsOptions,
	): Promise<JobWithMetadata<T>[]>;
	cancel(name: string, ids: string[], options?: { db?: Db }): Promise<unknown>;
	work<T extends JobData>(
		name: string,
		options: WorkOptions & { includeMetadata: true },
		handler: (jobs: JobWithMetadata<T>[]) => Promise<unknown>,
	): Promise<string>;
	getQueues(names?: string[]): Promise<QueueResult[]>;
}

type PgBossClientLoader = () => Promise<PgBossClient>;

export class LazyPgBossClient implements PgBossClient {
	private client?: PgBossClient;
	private starting?: Promise<PgBossClient>;
	private readonly errorListeners = new Set<(error: Error) => void>();

	constructor(private readonly load: PgBossClientLoader) {}

	async start(): Promise<unknown> {
		return this.ensureStarted();
	}

	async stop(options?: StopOptions): Promise<void> {
		const client = this.starting ? await this.starting : this.client;
		await client?.stop(options);
	}

	on(event: "error", listener: (error: Error) => void): unknown {
		this.errorListeners.add(listener);
		this.client?.on(event, listener);
		return this;
	}

	async createQueue(name: string, options?: QueueOptions): Promise<void> {
		await (await this.ensureStarted()).createQueue(name, options);
	}

	async updateQueue(name: string, options: UpdateQueueOptions): Promise<void> {
		await (await this.ensureStarted()).updateQueue(name, options);
	}

	async send(name: string, data: object, options: SendOptions): Promise<string | null> {
		return (await this.ensureStarted()).send(name, data, options);
	}

	async schedule(
		name: string,
		cron: string,
		data: object,
		options: ScheduleOptions,
	): Promise<void> {
		await (await this.ensureStarted()).schedule(name, cron, data, options);
	}

	async unschedule(name: string, key?: string): Promise<void> {
		await (await this.ensureStarted()).unschedule(name, key);
	}

	async findJobs<T extends JobData>(
		name: string,
		options?: FindJobsOptions,
	): Promise<JobWithMetadata<T>[]> {
		return (await this.ensureStarted()).findJobs<T>(name, options);
	}

	async cancel(name: string, ids: string[], options?: { db?: Db }): Promise<unknown> {
		return (await this.ensureStarted()).cancel(name, ids, options);
	}

	async work<T extends JobData>(
		name: string,
		options: WorkOptions & { includeMetadata: true },
		handler: (jobs: JobWithMetadata<T>[]) => Promise<unknown>,
	): Promise<string> {
		return (await this.ensureStarted()).work(name, options, handler);
	}

	async getQueues(names?: string[]): Promise<QueueResult[]> {
		return (await this.ensureStarted()).getQueues(names);
	}

	private async ensureStarted(): Promise<PgBossClient> {
		if (this.client) {
			return this.client;
		}

		this.starting ??= this.loadAndStart().catch((error: unknown) => {
			this.starting = undefined;
			throw error;
		});
		return this.starting;
	}

	private async loadAndStart(): Promise<PgBossClient> {
		const client = await this.load();
		for (const listener of this.errorListeners) {
			client.on("error", listener);
		}
		await client.start();
		this.client = client;
		return client;
	}
}

interface JobTransactionSource {
	readonly tx: PrismaTransactionLike;
}

interface JobRuntimeConfigSource {
	readonly job: {
		readonly shutdownTimeoutMs: number;
	};
}

export const pgBossClientProvider: FactoryProvider<PgBossClient> = {
	provide: PG_BOSS_CLIENT,
	inject: [TypedConfigService],
	useFactory: (config: TypedConfigService) =>
		new LazyPgBossClient(async () => {
			// pg-boss 12는 ESM 전용이다. PostgreSQL backend가 실제 시작될 때만
			// 로드하여 기본 Redis 배포와 CJS 기반 테스트에 영향을 주지 않는다.
			const { PgBoss } = await import("pg-boss");
			return new PgBoss({
				connectionString: config.databaseUrl,
				schema: config.job.schema,
				application_name: "aido-pg-boss",
				max: 3,
				migrate: false,
				createSchema: false,
				useListenNotify: false,
			});
		}),
};

@Injectable()
export class PgBossJobRuntimeAdapter implements JobRuntimePort {
	private readonly logger = new Logger(PgBossJobRuntimeAdapter.name);
	private readonly queueCreations = new Map<string, Promise<void>>();
	private readonly queuePolicyApplications = new Map<string, Promise<void>>();

	constructor(
		@Inject(PG_BOSS_CLIENT) private readonly boss: PgBossClient,
		@Inject(TransactionHost)
		private readonly txHost: JobTransactionSource,
		@Inject(TypedConfigService)
		private readonly config: JobRuntimeConfigSource,
	) {
		this.boss.on("error", (error) => {
			// 오류 종류만 기록한다. 작업 payload나 DB 연결 문자열은 로그에 남기지 않는다.
			this.logger.error(`pg-boss runtime error (${error.name})`);
		});
	}

	async start(): Promise<void> {
		await this.boss.start();
	}

	async stop(): Promise<void> {
		await this.boss.stop({
			graceful: true,
			timeout: this.config.job.shutdownTimeoutMs,
			close: true,
		});
	}

	async enqueue<T extends JobData>(
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<string | null> {
		const deadLetterQueue = resolveDeadLetterQueue(options.deadLetter);
		const deadLetterJobPolicy = resolveDeadLetterJobPolicy(options.deadLetter);
		if (deadLetterQueue) {
			await this.ensureQueue(deadLetterQueue, deadLetterJobPolicy);
		}
		await this.ensureQueue(queue);
		const idempotencyKey = resolveJobIdempotencyKey(options);
		const pgBossOptions = this.toPgBossOptions(options, this.transactionDatabase());
		return this.boss.send(queue, data, {
			...pgBossOptions,
			...(idempotencyKey && {
				id: deterministicJobId(queue, idempotencyKey),
			}),
		});
	}

	async schedule<T extends JobData>(
		scheduleKey: string,
		cron: string,
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<void> {
		const deadLetterQueue = resolveDeadLetterQueue(options.deadLetter);
		const deadLetterJobPolicy = resolveDeadLetterJobPolicy(options.deadLetter);
		if (deadLetterQueue) {
			await this.ensureQueue(deadLetterQueue, deadLetterJobPolicy);
		}
		await this.ensureQueue(queue);
		const {
			db: _transactionDb,
			singletonKey: _idempotencyKey,
			...persistedOptions
		} = this.toPgBossOptions(options, this.transactionDatabase());
		await this.boss.schedule(queue, cron, data, {
			...persistedOptions,
			key: scheduleKey,
			tz: options.timezone,
		});
	}

	async unschedule(scheduleKey: string, queue: string): Promise<void> {
		await this.boss.unschedule(queue, scheduleKey);
	}

	async cancel(queue: string, idempotencyKey: string): Promise<JobCancellationResult> {
		const db = this.transactionDatabase();
		const jobs = await this.boss.findJobs(queue, {
			key: idempotencyKey,
			queued: true,
			db,
		});
		if (jobs.length === 0) {
			return { status: "missing" };
		}

		const result = await this.boss.cancel(
			queue,
			jobs.map(({ id }) => id),
			{ db },
		);
		if (!hasAffectedCount(result)) {
			throw new Error("Invalid pg-boss cancellation response");
		}
		return result.affected > 0 ? { status: "cancelled" } : { status: "missing" };
	}

	async work<T extends JobData>(
		queue: string,
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
		await this.ensureQueue(queue, options.queuePolicy);
		await this.boss.work<T>(
			queue,
			{
				includeMetadata: true,
				localConcurrency: options.teamSize,
				pollingIntervalSeconds: options.pollingIntervalSeconds,
			},
			async (jobs) =>
				handler(
					jobs.map(({ id, name, data, retryCount }) => ({
						id,
						name,
						data,
						attempt: retryCount + 1,
					})),
				),
		);
	}

	async health(queueNames: readonly string[]): Promise<JobRuntimeHealth> {
		try {
			const queues = await this.boss.getQueues([...queueNames]);
			const byName = new Map(queues.map((queue) => [queue.name, queue]));

			return {
				backend: "postgres",
				degraded: false,
				queues: Object.fromEntries(
					queueNames.map((name) => {
						const queue = byName.get(name);
						return [
							name,
							{
								waiting: queue?.queuedCount ?? 0,
								active: queue?.activeCount ?? 0,
								failed: queue?.failedCount ?? 0,
								oldestAgeSeconds: null,
							},
						];
					}),
				),
			};
		} catch (error) {
			this.logger.error(
				`pg-boss health check failed (${error instanceof Error ? error.name : "UnknownError"})`,
			);
			return {
				backend: "postgres",
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

	private transactionDatabase(): Db {
		const transaction = this.txHost.tx;
		return {
			async executeSql(text, values) {
				const rows = await transaction.$queryRawUnsafe(text, ...(values ?? []));
				return { rows: Array.isArray(rows) ? rows : [] };
			},
		};
	}

	private toPgBossOptions(options: EnqueueJobOptions, db: Db): SendOptions {
		return {
			db,
			singletonKey: resolveJobIdempotencyKey(options),
			startAfter: options.startAfter,
			retryLimit: options.retryLimit,
			retryDelay: options.retryDelaySeconds,
			retryBackoff: options.retryBackoff,
			expireInSeconds: options.expireInSeconds,
			retentionSeconds: options.retentionSeconds,
			deleteAfterSeconds: options.deleteAfterSeconds,
			deadLetter: resolveDeadLetterQueue(options.deadLetter),
		};
	}

	private async ensureQueue(queue: string, queuePolicy?: JobRetryPolicy): Promise<void> {
		const existing = this.queueCreations.get(queue);
		if (existing) {
			await existing;
		} else {
			const creation = this.boss.createQueue(
				queue,
				queuePolicy ? this.toPgBossQueueOptions(queuePolicy) : undefined,
			);
			this.queueCreations.set(queue, creation);
			try {
				await creation;
			} catch (error) {
				this.queueCreations.delete(queue);
				throw error;
			}
		}

		if (queuePolicy) {
			await this.applyQueuePolicy(queue, queuePolicy);
		}
	}

	private async applyQueuePolicy(queue: string, policy: JobRetryPolicy): Promise<void> {
		const policyKey = `${queue}:${JSON.stringify(policy)}`;
		const existing = this.queuePolicyApplications.get(policyKey);
		if (existing) {
			await existing;
			return;
		}

		// createQueue는 기존 queue의 정책을 갱신하지 않는다. updateQueue를 함께 호출해
		// worker-first rolling 배포에서 이미 생성된 DLQ도 동일한 정책으로 수렴시킨다.
		const application = this.boss.updateQueue(queue, this.toPgBossQueueOptions(policy));
		this.queuePolicyApplications.set(policyKey, application);
		try {
			await application;
		} catch (error) {
			this.queuePolicyApplications.delete(policyKey);
			throw error;
		}
	}

	private toPgBossQueueOptions(policy: JobRetryPolicy): QueueOptions {
		return {
			retryLimit: policy.retryLimit,
			retryDelay: policy.retryDelaySeconds,
			retryBackoff: policy.retryBackoff,
			expireInSeconds: policy.expireInSeconds,
			retentionSeconds: policy.retentionSeconds,
			deleteAfterSeconds: policy.deleteAfterSeconds,
		};
	}
}

function hasAffectedCount(result: unknown): result is { readonly affected: number } {
	return (
		typeof result === "object" &&
		result !== null &&
		"affected" in result &&
		typeof result.affected === "number"
	);
}

export function deterministicJobId(queue: string, idempotencyKey: string): string {
	const bytes = Buffer.from(
		createHash("sha256").update(`${queue}:${idempotencyKey}`).digest().subarray(0, 16),
	);
	// 결정적 해시를 UUID version/variant 비트로 정규화해 pg-boss PK와 호환한다.
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
