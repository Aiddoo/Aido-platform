/**
 * SuggestionAnalysisJob (Dispatcher) 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - BullMQ Job Scheduler 등록 검증
 * - BullMQ 큐에 per-user 잡 등록 검증
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
		jest.clearAllMocks();

		const { unit, unitRef } = await TestBed.solitary(SuggestionAnalysisJob)
			.mock(getQueueToken(AI_SUGGESTION_QUEUE))
			.impl(() => ({
				addBulk: jest.fn().mockResolvedValue(undefined),
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(AI_SUGGESTION_QUEUE));
		mockProcessor = unitRef.get(SuggestionAnalysisProcessor);
	});

	// =========================================================================
	// onModuleInit 스케줄러 등록
	// =========================================================================

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 주간 분석 스케줄러를 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"weekly-suggestion-scheduler",
				{ pattern: "0 11 * * 0" },
				{ name: "dispatch-analysis", data: {} },
			);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockProcessor.setSuggestionJob).toHaveBeenCalledWith(job);
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
