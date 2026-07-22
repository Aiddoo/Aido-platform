import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type {
	JobBackend,
	JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import {
	JobRuntimeLifecycle,
	jobRuntimeProvider,
	POSTGRES_JOB_RUNTIME,
	REDIS_JOB_RUNTIME,
	selectJobRuntime,
} from "./job-runtime.module";

function createRuntime(): JobRuntimePort {
	return {
		start: jest.fn(),
		stop: jest.fn(),
		enqueue: jest.fn(),
		schedule: jest.fn(),
		cancel: jest.fn(),
		work: jest.fn(),
		health: jest.fn(),
	};
}

describe("selectJobRuntime — backend 선택", () => {
	it("postgres 설정이면 PostgreSQL runtime을 반환한다", () => {
		const postgres = createRuntime();
		const redis = createRuntime();

		expect(selectJobRuntime("postgres", postgres, redis)).toBe(postgres);
	});

	it("redis 설정이면 Redis runtime을 반환한다", () => {
		const postgres = createRuntime();
		const redis = createRuntime();

		expect(selectJobRuntime("redis", postgres, redis)).toBe(redis);
	});

	it.each<JobBackend>(["postgres", "redis"])(
		"Nest provider가 %s runtime을 JOB_RUNTIME으로 노출한다",
		async (backend) => {
			const postgres = createRuntime();
			const redis = createRuntime();
			const module = await Test.createTestingModule({
				providers: [
					jobRuntimeProvider,
					{ provide: ConfigService, useValue: { get: () => backend } },
					{ provide: POSTGRES_JOB_RUNTIME, useValue: postgres },
					{ provide: REDIS_JOB_RUNTIME, useValue: redis },
				],
			}).compile();

			expect(module.get(JOB_RUNTIME)).toBe(
				backend === "postgres" ? postgres : redis,
			);
			await module.close();
		},
	);
});

describe("JobRuntimeLifecycle — 선택 runtime 수명주기", () => {
	it("애플리케이션 시작과 종료를 선택된 runtime에 위임한다", async () => {
		const runtime = createRuntime();
		const lifecycle = new JobRuntimeLifecycle(runtime);

		await lifecycle.onApplicationBootstrap();
		await lifecycle.onApplicationShutdown();

		expect(runtime.start).toHaveBeenCalledTimes(1);
		expect(runtime.stop).toHaveBeenCalledTimes(1);
	});
});
