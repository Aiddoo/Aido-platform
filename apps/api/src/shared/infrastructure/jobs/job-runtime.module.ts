import {
	type FactoryProvider,
	Global,
	Inject,
	Injectable,
	Module,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	EnqueueJobOptions,
	JobBackend,
	JobCancellationResult,
	JobData,
	JobEnvelope,
	JobRuntimeHealth,
	JobRuntimePort,
	WorkJobOptions,
} from "@/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import type { EnvConfig } from "@/shared/infrastructure/config";
import {
	BullMqJobRuntimeAdapter,
	bullMqClientFactoryProvider,
	legacyQueueName,
} from "./bullmq-job-runtime.adapter";
import {
	PgBossJobRuntimeAdapter,
	pgBossClientProvider,
} from "./pg-boss-job-runtime.adapter";

export const POSTGRES_JOB_RUNTIME = Symbol("POSTGRES_JOB_RUNTIME");
export const REDIS_JOB_RUNTIME = Symbol("REDIS_JOB_RUNTIME");

/** PostgreSQL로 새 작업을 쓰면서 기존 Redis 작업을 한시적으로 drain한다. */
export class RedisDrainJobRuntime implements JobRuntimePort {
	constructor(
		private readonly primary: JobRuntimePort,
		private readonly redis: JobRuntimePort,
	) {}

	async start(): Promise<void> {
		await Promise.all([this.primary.start(), this.redis.start()]);
	}

	async stop(): Promise<void> {
		await Promise.all([this.primary.stop(), this.redis.stop()]);
	}

	enqueue<T extends JobData>(
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<string | null> {
		return this.primary.enqueue(queue, data, options);
	}

	async schedule<T extends JobData>(
		scheduleKey: string,
		cron: string,
		queue: string,
		data: T,
		options: EnqueueJobOptions,
	): Promise<void> {
		await this.primary.schedule(scheduleKey, cron, queue, data, options);
		// BullMQ repeat metadata creates jobs independently of workers. Remove the
		// Redis scheduler so the legacy queue can actually reach zero while draining.
		await this.redis.unschedule(scheduleKey, queue);
		const legacyQueue = legacyQueueName(queue);
		if (legacyQueue) {
			await this.redis.unschedule(scheduleKey, legacyQueue);
		}
	}

	async unschedule(scheduleKey: string, queue: string): Promise<void> {
		await Promise.all([
			this.primary.unschedule(scheduleKey, queue),
			this.redis.unschedule(scheduleKey, queue),
		]);
	}

	async cancel(queue: string, jobKey: string): Promise<JobCancellationResult> {
		const legacyQueue = legacyQueueName(queue);
		const cancellations = [
			this.primary.cancel(queue, jobKey),
			this.redis.cancel(queue, jobKey),
			...(legacyQueue ? [this.redis.cancel(legacyQueue, jobKey)] : []),
		];
		const results = await Promise.all(cancellations);

		return results.some(({ status }) => status === "cancelled")
			? { status: "cancelled" }
			: { status: "missing" };
	}

	async work<T extends JobData>(
		queue: string,
		handler: (jobs: readonly JobEnvelope<T>[]) => Promise<void>,
		options: WorkJobOptions,
	): Promise<void> {
		await Promise.all([
			this.primary.work(queue, handler, options),
			this.redis.work(queue, handler, options),
		]);
	}

	health(queueNames: readonly string[]): Promise<JobRuntimeHealth> {
		return this.primary.health(queueNames);
	}
}

export function selectJobRuntime(
	backend: JobBackend,
	postgres: JobRuntimePort,
	redis: JobRuntimePort,
	redisDrainEnabled = false,
): JobRuntimePort {
	if (backend === "redis") return redis;
	return redisDrainEnabled
		? new RedisDrainJobRuntime(postgres, redis)
		: postgres;
}

export const jobRuntimeProvider: FactoryProvider<JobRuntimePort> = {
	provide: JOB_RUNTIME,
	inject: [ConfigService, POSTGRES_JOB_RUNTIME, REDIS_JOB_RUNTIME],
	useFactory: (
		config: ConfigService<EnvConfig, true>,
		postgres: JobRuntimePort,
		redis: JobRuntimePort,
	) =>
		selectJobRuntime(
			config.get("JOB_BACKEND", { infer: true }),
			postgres,
			redis,
			config.get("JOB_REDIS_DRAIN_ENABLED", { infer: true }),
		),
};

@Injectable()
export class JobRuntimeLifecycle
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.runtime.start();
	}

	async onApplicationShutdown(): Promise<void> {
		await this.runtime.stop();
	}
}

@Global()
@Module({
	providers: [
		pgBossClientProvider,
		bullMqClientFactoryProvider,
		PgBossJobRuntimeAdapter,
		BullMqJobRuntimeAdapter,
		{
			provide: POSTGRES_JOB_RUNTIME,
			useExisting: PgBossJobRuntimeAdapter,
		},
		{
			provide: REDIS_JOB_RUNTIME,
			useExisting: BullMqJobRuntimeAdapter,
		},
		jobRuntimeProvider,
		JobRuntimeLifecycle,
	],
	exports: [JOB_RUNTIME],
})
export class JobRuntimeModule {}
