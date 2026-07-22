import { HealthIndicatorService } from "@nestjs/terminus";
import type { JobRuntimePort } from "@/shared/application/ports/job-runtime.port";
import { BullHealthIndicator } from "./bull.health";

function runtime(): jest.Mocked<JobRuntimePort> {
	return {
		start: jest.fn(),
		stop: jest.fn(),
		enqueue: jest.fn(),
		schedule: jest.fn(),
		unschedule: jest.fn(),
		cancel: jest.fn(),
		work: jest.fn(),
		health: jest.fn().mockResolvedValue({
			backend: "postgres",
			degraded: false,
			queues: {
				"ai-report-generation.v1": {
					waiting: 2,
					active: 1,
					failed: 0,
					oldestAgeSeconds: null,
				},
			},
		}),
	};
}

describe("BullHealthIndicator — durable job runtime health", () => {
	it("선택된 backend와 큐 카운트를 up 응답으로 반환한다", async () => {
		const jobRuntime = runtime();
		const indicator = new BullHealthIndicator(
			new HealthIndicatorService(),
			jobRuntime,
		);

		const result = await indicator.isHealthy("queues");

		expect(result.queues).toMatchObject({
			status: "up",
			backend: "postgres",
			degraded: false,
		});
		expect(jobRuntime.health).toHaveBeenCalledWith([
			"ai-suggestion-analysis.v1",
			"ai-report-generation.v1",
			"admin-notification.v1",
			"todo-reminder.v1",
		]);
	});

	it("backend 장애도 503 대신 up + degraded로 유지한다", async () => {
		const jobRuntime = runtime();
		jobRuntime.health.mockResolvedValue({
			backend: "postgres",
			degraded: true,
			reason: "job_runtime_unavailable",
			queues: {},
		});
		const indicator = new BullHealthIndicator(
			new HealthIndicatorService(),
			jobRuntime,
		);

		const result = await indicator.isHealthy("queues");

		expect(result.queues).toMatchObject({
			status: "up",
			degraded: true,
			reason: "job_runtime_unavailable",
		});
	});

	it("health 수집 실패도 up + degraded로 정규화한다", async () => {
		const jobRuntime = runtime();
		jobRuntime.health.mockRejectedValue(new Error("database unavailable"));
		const indicator = new BullHealthIndicator(
			new HealthIndicatorService(),
			jobRuntime,
		);

		const result = await indicator.isHealthy("queues");

		expect(result.queues).toMatchObject({
			status: "up",
			degraded: true,
			reason: "job_runtime_health_timeout",
		});
	});

	it("health가 멈추면 2초 후 degraded로 반환한다", async () => {
		jest.useFakeTimers();
		const jobRuntime = runtime();
		jobRuntime.health.mockReturnValue(new Promise(() => {}));
		const indicator = new BullHealthIndicator(
			new HealthIndicatorService(),
			jobRuntime,
		);

		const pending = indicator.isHealthy("queues");
		await jest.advanceTimersByTimeAsync(2_000);
		await expect(pending).resolves.toMatchObject({
			queues: { status: "up", degraded: true },
		});
		jest.useRealTimers();
	});
});
