import type { Mocked } from "vitest";
import { mock } from "vitest-mock-extended";

import { NotificationPublisher } from "#api/notification/index";
/**
 * SuggestionAnalysisProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 서비스 위임 검증
 * - 패턴 감지 여부에 따른 알림 발송 검증
 */
import { createMockDatabaseContext } from "#test/mocks/database.mock";
import { createMockJob } from "#test/mocks/index";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";

import { AnalyzeAndCreateSuggestionsUseCase } from "../../application/use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case.js";
import { type AiSuggestionJobData, AiSuggestionJobName } from "../queue/ai-suggestion-queue.js";
import { SuggestionAnalysisProcessor } from "./suggestion-analysis.processor.js";

describe("SuggestionAnalysisProcessor — AI 제안 분석 프로세서", () => {
  let processor: SuggestionAnalysisProcessor;
  let analyzeAndCreateSuggestionsUseCase: Mocked<AnalyzeAndCreateSuggestionsUseCase>;
  let mockNotificationService: Mocked<NotificationPublisher>;

  beforeEach(async () => {
    const context = createMockDatabaseContext();
    context.orm.public.UserPreference.first.mockResolvedValue(null);
    analyzeAndCreateSuggestionsUseCase = mock<AnalyzeAndCreateSuggestionsUseCase>();
    mockNotificationService = mock<NotificationPublisher>();
    processor = new SuggestionAnalysisProcessor(
      analyzeAndCreateSuggestionsUseCase,
      mockNotificationService,
      createMockDatabaseService(context),
    );
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
      mockNotificationService.publish.mockResolvedValue(null);

      // When -process를 호출하면
      await processor.process(
        createMockJob<AiSuggestionJobData>(AiSuggestionJobName.ANALYZE, {
          userId: "user-123",
          timezone: "Asia/Seoul",
          weatherGrid: null,
        }),
      );

      // Then -알림이 발송되어야 한다
      expect(mockNotificationService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          type: "AI_SUGGESTION",
          campaignKey: "ai_suggestion_v2",
          variantId: "default",
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
      expect(mockNotificationService.publish).not.toHaveBeenCalled();
    });
  });
});
