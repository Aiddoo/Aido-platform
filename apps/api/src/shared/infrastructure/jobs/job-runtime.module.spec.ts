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
		unschedule: jest.fn(),
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

	it("postgres drain 모드는 새 작업은 PostgreSQL에만 쓰고 worker는 양쪽에 등록한다", async () => {
		const postgres = createRuntime();
		const redis = createRuntime();
		const runtime = selectJobRuntime("postgres", postgres, redis, true);
		const handler = jest.fn();
		const options = {
			retryLimit: 2,
			retryDelaySeconds: 1,
			retryBackoff: true,
			expireInSeconds: 60,
			retentionSeconds: 60,
			deleteAfterSeconds: 60,
		};

		await runtime.enqueue("paid-document.v1", { documentId: "42" }, options);
		await runtime.work("paid-document.v1", handler, {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});
		await runtime.schedule(
			"paid-document-daily",
			"0 9 * * *",
			"paid-document.v1",
			{ documentId: "42" },
			options,
		);

		expect(postgres.enqueue).toHaveBeenCalledTimes(1);
		expect(redis.enqueue).not.toHaveBeenCalled();
		expect(postgres.work).toHaveBeenCalledTimes(1);
		expect(redis.work).toHaveBeenCalledTimes(1);
		expect(postgres.schedule).toHaveBeenCalledTimes(1);
		expect(redis.schedule).not.toHaveBeenCalled();
		expect(redis.unschedule).toHaveBeenCalledWith(
			"paid-document-daily",
			"paid-document.v1",
		);
	});

	it.each<JobBackend>(["postgres", "redis"])(
		"Nest provider가 %s runtime을 JOB_RUNTIME으로 노출한다",
		async (backend) => {
			const postgres = createRuntime();
			const redis = createRuntime();
			const module = await Test.createTestingModule({
				providers: [
					jobRuntimeProvider,
					{
						provide: ConfigService,
						useValue: {
							get: (key: string) => (key === "JOB_BACKEND" ? backend : false),
						},
					},
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
