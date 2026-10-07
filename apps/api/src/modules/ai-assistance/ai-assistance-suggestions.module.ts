import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import { NotificationModule } from "../notification/notification-delivery.module.js";
import { PlanningTodosModule } from "../planning/planning-todos.module.js";
import { WeatherModule } from "../weather/weather-forecast.module.js";
import { AiModule } from "./ai-assistance-parsing.module.js";
import { AiReportModule } from "./ai-assistance-reports.module.js";
import {
  analyzeAndCreateSuggestionsProvider,
  getPendingSuggestionsProvider,
  handleSuggestionActionProvider,
  suggestionContextBuilderProvider,
} from "./ai-assistance-suggestions-application.providers.js";
import { AI_SUGGESTION_REPOSITORY } from "./application/ports/suggestions/ai-suggestion.repository.port.js";
import { RECURRING_TODO_CREATOR } from "./application/ports/suggestions/recurring-todo-creator.port.js";
import { WEEKLY_REPORT_READER } from "./application/ports/suggestions/weekly-report-reader.port.js";
import { RecurringTodoCreatorAdapter } from "./infrastructure/adapters/suggestions/recurring-todo-creator.adapter.js";
import { WeeklyReportReaderAdapter } from "./infrastructure/adapters/suggestions/weekly-report-reader.adapter.js";
import { AiSuggestionQueueMaintenanceService } from "./infrastructure/jobs/suggestions/ai-suggestion-queue-maintenance.service.js";
import { SuggestionAnalysisJob } from "./infrastructure/jobs/suggestions/suggestion-analysis.job.js";
import { PrismaAiSuggestionRepository } from "./infrastructure/persistence/suggestions/prisma-ai-suggestion.repository.js";
import { SuggestionAnalysisProcessor } from "./infrastructure/processors/suggestions/suggestion-analysis.processor.js";
import { AiSuggestionController } from "./presentation/controllers/suggestions/ai-suggestion.controller.js";

/**
 * AI 반복 제안 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 사용자의 할 일 패턴을 AI가 분석하여 반복 할 일을 제안합니다.
 * 컨트롤러·프로세서는 AiSuggestionFacade만 주입합니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회 / 제안 수락(반복 할 일 자동 생성)·거절
 * - 매일 KST 07:30 크론 → per-user 패턴 분석(BullMQ) → 새 제안 생성 + 알림
 *
 * ### 크로스모듈(전부 포트/어댑터로 역전)
 * - AiModule: AI_PROVIDER(Gemini)로 제안 생성
 * - PlanningTodosModule: 수락 시 RECURRING_TODO_CREATOR가 반복 생성 UseCase에 위임
 * - AiReportModule: WEEKLY_REPORT_READER가 최신 주간 보고서 인사이트 주입
 * - WeatherModule: 날씨 기반 제안을 위한 격자 예보 조회
 * - NotificationModule: 새 제안 생성 시 알림 발송(프로세서)
 */
@Module({
  imports: [
    AccessModule,
    AiModule,
    AiReportModule,
    NotificationModule,
    PlanningTodosModule,
    WeatherModule,
  ],
  controllers: [AiSuggestionController],
  providers: [
    {
      provide: AI_SUGGESTION_REPOSITORY,
      useClass: PrismaAiSuggestionRepository,
    },
    { provide: RECURRING_TODO_CREATOR, useClass: RecurringTodoCreatorAdapter },
    { provide: WEEKLY_REPORT_READER, useClass: WeeklyReportReaderAdapter },
    suggestionContextBuilderProvider,
    getPendingSuggestionsProvider,
    handleSuggestionActionProvider,
    analyzeAndCreateSuggestionsProvider,
    SuggestionAnalysisJob,
    SuggestionAnalysisProcessor,
    AiSuggestionQueueMaintenanceService,
  ],
})
export class AiSuggestionModule {}
