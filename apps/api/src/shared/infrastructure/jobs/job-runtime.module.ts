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
	JobBackend,
	JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import type { EnvConfig } from "@/shared/infrastructure/config";
import {
	BullMqJobRuntimeAdapter,
	bullMqClientFactoryProvider,
} from "./bullmq-job-runtime.adapter";
import {
	PgBossJobRuntimeAdapter,
	pgBossClientProvider,
} from "./pg-boss-job-runtime.adapter";

export const POSTGRES_JOB_RUNTIME = Symbol("POSTGRES_JOB_RUNTIME");
export const REDIS_JOB_RUNTIME = Symbol("REDIS_JOB_RUNTIME");

export function selectJobRuntime(
	backend: JobBackend,
	postgres: JobRuntimePort,
	redis: JobRuntimePort,
): JobRuntimePort {
	return backend === "postgres" ? postgres : redis;
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
