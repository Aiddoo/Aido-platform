/**
 * SuggestionAnalysisJob 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 분산 락 획득/해제 검증
 * - 사용자 반복 처리 검증
 * - 개별 사용자 에러 격리 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";

import { AiSuggestionService } from "../ai-suggestion.service";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job";

describe("SuggestionAnalysisJob", () => {
	let job: SuggestionAnalysisJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockAiSuggestionService: Mocked<AiSuggestionService>;
	let mockNotificationService: Mocked<NotificationService>;
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
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockAiSuggestionService = unitRef.get(AiSuggestionService);
		mockNotificationService = unitRef.get(NotificationService);
		mockLockProvider = unitRef.get(LOCK_PROVIDER);
	});

	// =========================================================================
	// 분산 락
	// =========================================================================

	describe("분산 락", () => {
		it("잠금을 획득하고 작업 완료 후 해제해야 한다", async () => {
			// Given: 잠금 획득 성공
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: 잠금 획득과 해제가 호출되어야 한다
			expect(mockLockProvider.acquire).toHaveBeenCalledWith(
				"suggestion-analysis",
				expect.any(Number),
			);
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});

		it("잠금 획득 실패 시 작업을 건너뛰어야 한다", async () => {
			// Given: 잠금 획득 실패
			mockLockProvider.acquire.mockResolvedValue(null);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: 사용자 조회가 호출되지 않아야 한다
			expect(mockDatabase.user.findMany).not.toHaveBeenCalled();
		});

		it("작업 중 에러가 발생해도 잠금이 해제되어야 한다", async () => {
			// Given: 잠금 획득 성공하지만 조회에서 에러 발생
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockRejectedValue(
				new Error("DB error"),
			);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: finally 블록에서 잠금이 해제되어야 한다
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// 사용자 반복 처리
	// =========================================================================

	describe("사용자 반복 처리", () => {
		it("최근 할 일이 있는 모든 사용자에 대해 분석을 수행해야 한다", async () => {
			// Given: 2명의 사용자
			const users = [{ id: "user-1" }, { id: "user-2" }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(1);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: 2명의 사용자에 대해 분석이 호출되어야 한다
			expect(
				mockAiSuggestionService.analyzeAndCreateSuggestions,
			).toHaveBeenCalledTimes(2);
			expect(
				mockAiSuggestionService.analyzeAndCreateSuggestions,
			).toHaveBeenCalledWith("user-1");
			expect(
				mockAiSuggestionService.analyzeAndCreateSuggestions,
			).toHaveBeenCalledWith("user-2");
		});

		it("제안이 생성되지 않으면 알림을 보내지 않아야 한다", async () => {
			// Given: 제안 생성이 0을 반환 (패턴 없음)
			const users = [{ id: "user-1" }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(0);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: 알림이 발송되지 않아야 한다
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("제안이 생성되면 알림을 발송해야 한다", async () => {
			// Given: 제안 생성 성공
			const users = [{ id: "user-1" }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(2);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: AI_SUGGESTION 알림이 발송되어야 한다
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "AI_SUGGESTION",
					title: expect.any(String),
					body: expect.any(String),
				}),
			);
		});
	});

	// =========================================================================
	// 에러 격리
	// =========================================================================

	describe("에러 격리", () => {
		it("한 사용자의 에러가 다른 사용자 처리에 영향을 주지 않아야 한다", async () => {
			// Given: user-1은 에러, user-2는 정상
			const users = [{ id: "user-1" }, { id: "user-2" }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			mockAiSuggestionService.analyzeAndCreateSuggestions
				.mockRejectedValueOnce(new Error("user-1 에러"))
				.mockResolvedValueOnce(1);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyAnalysis를 호출하면
			await job.handleWeeklyAnalysis();

			// Then: user-2의 분석과 알림이 정상적으로 처리되어야 한다
			expect(
				mockAiSuggestionService.analyzeAndCreateSuggestions,
			).toHaveBeenCalledTimes(2);
			expect(mockNotificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({ userId: "user-2" }),
			);
		});
	});
});
