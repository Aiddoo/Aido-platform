import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";
import { AI_SUGGESTION_QUEUE } from "./ai-suggestion-queue";
import { AiSuggestionQueueMaintenanceService } from "./ai-suggestion-queue-maintenance.service";

describe("AiSuggestionQueueMaintenanceService — AI 제안 큐 유지보수", () => {
	let service: AiSuggestionQueueMaintenanceService;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			AiSuggestionQueueMaintenanceService,
		)
			.mock(getQueueToken(AI_SUGGESTION_QUEUE))
			.impl(() => ({ clean: jest.fn().mockResolvedValue([]) }))
			.compile();

		service = unit;
		queue = unitRef.get(getQueueToken(AI_SUGGESTION_QUEUE));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("7일이 지난 실패 잡을 최대 1,000건 정리하고 삭제 수를 반환한다", async () => {
		// Given
		queue.clean.mockResolvedValue(["failed-1", "failed-2"]);

		// When
		const removedCount = await service.cleanExpiredFailures();

		// Then
		expect(queue.clean).toHaveBeenCalledWith(
			7 * 24 * 60 * 60 * 1_000,
			1_000,
			"failed",
		);
		expect(removedCount).toBe(2);
	});

	it("Redis 정리가 실패하면 예외를 전파하지 않고 0을 반환한다", async () => {
		// Given
		queue.clean.mockRejectedValue(new Error("redis cleanup failed"));

		// When & Then
		await expect(service.cleanExpiredFailures()).resolves.toBe(0);
	});

	it("Redis 정리가 응답하지 않으면 2초 후 0을 반환한다", async () => {
		// Given
		jest.useFakeTimers();
		queue.clean.mockReturnValue(new Promise<string[]>(() => {}));

		// When
		const pending = service.cleanExpiredFailures();
		await jest.advanceTimersByTimeAsync(2_000);

		// Then
		await expect(pending).resolves.toBe(0);
	});
});
