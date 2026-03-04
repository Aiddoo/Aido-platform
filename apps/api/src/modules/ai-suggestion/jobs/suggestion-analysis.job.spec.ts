/**
 * SuggestionAnalysisJob (Dispatcher) 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 분산 락 획득/해제 검증
 * - BullMQ 큐에 per-user 잡 등록 검증
 */

import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { AI_SUGGESTION_QUEUE } from "../processors/suggestion-analysis.processor";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job";

describe("SuggestionAnalysisJob", () => {
	let job: SuggestionAnalysisJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockQueue: Mocked<Queue>;
	let mockLockProvider: Mocked<ILockProvider>;

	const mockRelease = jest.fn().mockResolvedValue(undefined);

	beforeEach(async () => {
		jest.clearAllMocks();

		const { unit, unitRef } = await TestBed.solitary(SuggestionAnalysisJob)
			.mock(LOCK_PROVIDER)
			.impl(() => ({
				acquire: jest.fn(),
				isLocked: jest.fn(),
			}))
			.mock(getQueueToken(AI_SUGGESTION_QUEUE))
			.impl(() => ({
				addBulk: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(AI_SUGGESTION_QUEUE));
		mockLockProvider = unitRef.get(LOCK_PROVIDER);
	});

	// =========================================================================
	// 분산 락
	// =========================================================================

	describe("분산 락", () => {
		it("잠금을 획득하고 작업 완료 후 해제해야 한다", async () => {
			// Given
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await job.handleWeeklyAnalysis();

			// Then
			expect(mockLockProvider.acquire).toHaveBeenCalledWith(
				"suggestion-analysis",
				expect.any(Number),
			);
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});

		it("잠금 획득 실패 시 작업을 건너뛰어야 한다", async () => {
			// Given
			mockLockProvider.acquire.mockResolvedValue(null);

			// When
			await job.handleWeeklyAnalysis();

			// Then
			expect(mockDatabase.user.findMany).not.toHaveBeenCalled();
		});

		it("작업 중 에러가 발생해도 잠금이 해제되어야 한다", async () => {
			// Given
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockRejectedValue(
				new Error("DB error"),
			);

			// When
			await job.handleWeeklyAnalysis();

			// Then
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// BullMQ 잡 등록
	// =========================================================================

	describe("BullMQ 잡 등록", () => {
		it("최근 할 일이 있는 모든 사용자에 대해 큐에 잡을 등록해야 한다", async () => {
			// Given
			const users = [
				{ id: "user-1", preference: { timezone: "Asia/Seoul" } },
				{ id: "user-2", preference: { timezone: "America/New_York" } },
			];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.handleWeeklyAnalysis();

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
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.handleWeeklyAnalysis();

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
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.handleWeeklyAnalysis();

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]?.opts).toEqual(
				expect.objectContaining({
					attempts: 3,
					backoff: { type: "exponential", delay: 5_000 },
					removeOnComplete: true,
					removeOnFail: 100,
				}),
			);
		});

		it("사용자가 없으면 큐에 잡을 등록하지 않아야 한다", async () => {
			// Given
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await job.handleWeeklyAnalysis();

			// Then
			expect(mockQueue.addBulk).not.toHaveBeenCalled();
		});
	});
});
