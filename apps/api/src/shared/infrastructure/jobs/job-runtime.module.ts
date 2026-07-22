import { type FactoryProvider, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	JobBackend,
	JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import type { EnvConfig } from "@/shared/infrastructure/config";

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

@Global()
@Module({
	providers: [jobRuntimeProvider],
	exports: [JOB_RUNTIME],
})
export class JobRuntimeModule {}
