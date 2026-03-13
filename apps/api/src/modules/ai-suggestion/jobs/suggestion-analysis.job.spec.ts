/**
 * SuggestionAnalysisJob (Dispatcher) 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - BullMQ Job Scheduler 등록 검증
 * - BullMQ 큐에 per-user 잡 등록 검증
 * - Startup catch-up 검증
 */

import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";
import { DatabaseService } from "@/database/database.service";
import {
	AI_SUGGESTION_QUEUE,
	SuggestionAnalysisProcessor,
} from "../processors/suggestion-analysis.processor";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job";

describe("SuggestionAnalysisJob", () => {
	let job: SuggestionAnalysisJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockQueue: Mocked<Queue>;
	let mockProcessor: Mocked<SuggestionAnalysisProcessor>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SuggestionAnalysisJob)
			.mock(getQueueToken(AI_SUGGESTION_QUEUE))
			.impl(() => ({
				add: jest.fn().mockResolvedValue(undefined),
				addBulk: jest.fn().mockResolvedValue(undefined),
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
				removeJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(AI_SUGGESTION_QUEUE));
		mockProcessor = unitRef.get(SuggestionAnalysisProcessor);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// onModuleInit 스케줄러 등록
	// =========================================================================

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 매일 분석 스케줄러를 등록해야 한다", async () => {
			// Given — 오전 (catch-up 미발동)
			jest.useFakeTimers({ now: new Date("2026-03-09T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"daily-suggestion-scheduler",
				{ pattern: "0 11 * * *", tz: "Asia/Seoul" },
				{ name: "dispatch-analysis", data: {} },
			);
		});

		it("구 weekly 스케줄러를 제거해야 한다", async () => {
			// Given
			jest.useFakeTimers({ now: new Date("2026-03-09T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith(
				"weekly-suggestion-scheduler",
			);
		});

		it("구 스케줄러 제거가 새 스케줄러 등록보다 먼저 호출되어야 한다", async () => {
			// Given
			jest.useFakeTimers({ now: new Date("2026-03-09T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			const removeOrder =
				mockQueue.removeJobScheduler.mock.invocationCallOrder[0];
			const upsertOrder =
				mockQueue.upsertJobScheduler.mock.invocationCallOrder[0];
			expect(removeOrder).toBeLessThan(upsertOrder as number);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// Given
			jest.useFakeTimers({ now: new Date("2026-03-09T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockProcessor.setSuggestionJob).toHaveBeenCalledWith(job);
		});
	});

	// =========================================================================
	// catch-up on startup
	// =========================================================================

	describe("catch-up on startup", () => {
		it("11:00 이후 시작 시 dispatch 잡을 추가해야 한다", async () => {
			// Given — 월요일 13:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T13:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).toHaveBeenCalledWith(
				"dispatch-analysis",
				{},
				{ jobId: expect.stringContaining("dispatch_suggestion_") },
			);
		});

		it("11:00 이전에 시작 시 catch-up하지 않아야 한다", async () => {
			// Given — 월요일 10:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// dispatchAnalysis (BullMQ 잡 등록)
	// =========================================================================

	describe("dispatchAnalysis", () => {
		it("최근 할 일이 있는 모든 사용자에 대해 큐에 잡을 등록해야 한다", async () => {
			// Given
			const users = [
				{ id: "user-1", preference: { timezone: "Asia/Seoul" } },
				{ id: "user-2", preference: { timezone: "America/New_York" } },
			];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchAnalysis();

			// Then
			expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs).toHaveLength(2);
			expect(jobs?.[0]).toEqual(
				expect.objectContaining({
					name: "analyze-suggestion",
					data: expect.objectContaining({
						userId: "user-1",
						timezone: "Asia/Seoul",
					}),
				}),
			);
			expect(jobs?.[1]).toEqual(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "user-2",
						timezone: "America/New_York",
					}),
				}),
			);
		});

		it("preference가 없으면 기본 타임존 'Asia/Seoul'을 사용해야 한다", async () => {
			// Given
			const users = [{ id: "user-1", preference: null }];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchAnalysis();

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]?.data).toEqual(
				expect.objectContaining({
					timezone: "Asia/Seoul",
				}),
			);
		});

		it("잡에 retry 옵션이 설정되어야 한다", async () => {
			// Given
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchAnalysis();

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]?.opts).toEqual(
				expect.objectContaining({
					attempts: 3,
					backoff: { type: "exponential", delay: 5_000 },
					removeOnComplete: { age: 604_800, count: 10_000 },
					removeOnFail: { count: 100, age: 86_400 },
				}),
			);
		});

		it("사용자가 없으면 큐에 잡을 등록하지 않아야 한다", async () => {
			// Given
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await job.dispatchAnalysis();

			// Then
			expect(mockQueue.addBulk).not.toHaveBeenCalled();
		});
	});
});
