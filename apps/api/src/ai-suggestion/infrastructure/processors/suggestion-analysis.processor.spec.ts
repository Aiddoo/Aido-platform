/**
 * SuggestionAnalysisProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 서비스 위임 검증
 * - 패턴 감지 여부에 따른 알림 발송 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockJob } from "@test/mocks";

import { NotificationSender } from "@/notification";
import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case";
import {
	type AiSuggestionJobData,
	AiSuggestionJobName,
} from "../queue/ai-suggestion-queue";
import { SuggestionAnalysisProcessor } from "./suggestion-analysis.processor";

describe("SuggestionAnalysisProcessor — AI 제안 분석 프로세서", () => {
	let processor: SuggestionAnalysisProcessor;
	let analyzeAndCreateSuggestionsUseCase: Mocked<AnalyzeAndCreateSuggestionsUseCase>;
	let mockNotificationService: Mocked<NotificationSender>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SuggestionAnalysisProcessor,
		).compile();

		processor = unit;
		analyzeAndCreateSuggestionsUseCase = unitRef.get(
			AnalyzeAndCreateSuggestionsUseCase,
		);
		mockNotificationService = unitRef.get(NotificationSender);
	});

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			// When & Then: 에러 없이 호출되어야 한다
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	describe("서비스 위임", () => {
		it("서비스에 userId와 timezone을 전달해야 한다", async () => {
			// Given -분석 대상 사용자
			analyzeAndCreateSuggestionsUseCase.execute.mockResolvedValue(0);

			// When -process를 호출하면
			await processor.process(
				createMockJob<AiSuggestionJobData>(AiSuggestionJobName.ANALYZE, {
					userId: "user-123",
					timezone: "Asia/Seoul",
					weatherGrid: null,
				}),
			);

			// Then -서비스에 올바른 파라미터를 전달해야 한다
			expect(analyzeAndCreateSuggestionsUseCase.execute).toHaveBeenCalledWith(
				"user-123",
				"Asia/Seoul",
				null,
				"ko",
			);
		});
	});

	describe("알림 발송", () => {
		it("패턴 감지 시 알림을 발송해야 한다", async () => {
			// Given -제안이 3개 생성된 상황
			analyzeAndCreateSuggestionsUseCase.execute.mockResolvedValue(3);
			mockNotificationService.createAndSend.mockResolvedValue(null);

			// When -process를 호출하면
			await processor.process(
				createMockJob<AiSuggestionJobData>(AiSuggestionJobName.ANALYZE, {
					userId: "user-123",
					timezone: "Asia/Seoul",
					weatherGrid: null,
				}),
			);

			// Then -알림이 발송되어야 한다
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					type: "AI_SUGGESTION",
				}),
			);
		});

		it("패턴 미감지 시 알림을 발송하지 않아야 한다", async () => {
			// Given -제안이 생성되지 않은 상황
			analyzeAndCreateSuggestionsUseCase.execute.mockResolvedValue(0);

			// When -process를 호출하면
			await processor.process(
				createMockJob<AiSuggestionJobData>(AiSuggestionJobName.ANALYZE, {
					userId: "user-123",
					timezone: "Asia/Seoul",
					weatherGrid: null,
				}),
			);

			// Then -알림이 발송되지 않아야 한다
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});
	});
});
