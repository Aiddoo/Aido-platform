/**
 * SuggestionAnalysisProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 서비스 위임 검증
 * - 패턴 감지 여부에 따른 알림 발송 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import { NotificationService } from "../../notification/notification.service";
import { AiSuggestionService } from "../ai-suggestion.service";
import {
	type AiSuggestionJobData,
	AiSuggestionJobName,
	SuggestionAnalysisProcessor,
} from "./suggestion-analysis.processor";

describe("SuggestionAnalysisProcessor — AI 제안 분석 프로세서", () => {
	let processor: SuggestionAnalysisProcessor;
	let mockAiSuggestionService: Mocked<AiSuggestionService>;
	let mockNotificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SuggestionAnalysisProcessor,
		).compile();

		processor = unit;
		mockAiSuggestionService = unitRef.get(AiSuggestionService);
		mockNotificationService = unitRef.get(NotificationService);
	});

	function createMockJob(data: AiSuggestionJobData): Job<AiSuggestionJobData> {
		return {
			name: AiSuggestionJobName.ANALYZE,
			data,
		} as unknown as Job<AiSuggestionJobData>;
	}

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			// When & Then: 에러 없이 호출되어야 한다
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	describe("서비스 위임", () => {
		it("서비스에 userId와 timezone을 전달해야 한다", async () => {
			// Given -분석 대상 사용자
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(0);

			// When -process를 호출하면
			await processor.process(
				createMockJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					weatherGrid: null,
				}),
			);

			// Then -서비스에 올바른 파라미터를 전달해야 한다
			expect(
				mockAiSuggestionService.analyzeAndCreateSuggestions,
			).toHaveBeenCalledWith("user-123", "Asia/Seoul", null, "ko");
		});
	});

	describe("알림 발송", () => {
		it("패턴 감지 시 알림을 발송해야 한다", async () => {
			// Given -제안이 3개 생성된 상황
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(3);
			mockNotificationService.createAndSend.mockResolvedValue(
				undefined as never,
			);

			// When -process를 호출하면
			await processor.process(
				createMockJob({
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
			mockAiSuggestionService.analyzeAndCreateSuggestions.mockResolvedValue(0);

			// When -process를 호출하면
			await processor.process(
				createMockJob({
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
