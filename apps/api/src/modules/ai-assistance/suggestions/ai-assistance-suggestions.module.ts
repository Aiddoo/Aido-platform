import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { IdentityUserAccessModule } from "#api/modules/identity/identity-user-access.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { WeatherForecastsModule } from "#api/modules/weather/forecasts/weather-forecasts.public";

import { AiAssistanceGenerationModule } from "../generation/ai-assistance-generation.module.js";
import { AiAssistanceParsingModule } from "../parsing/ai-assistance-parsing.module.js";
import { AiAssistanceReportsModule } from "../reports/ai-assistance-reports.module.js";
import {
  analyzeAndCreateSuggestionsProvider,
  listPendingSuggestionsProvider,
  handleSuggestionActionProvider,
  suggestionContextReaderProvider,
} from "./ai-assistance-suggestions-application.providers.js";
import { SUGGESTION_REPOSITORY } from "./application/ports/suggestion.repository.port.js";
import { WEEKLY_REPORT_READER } from "./application/ports/weekly-report.reader.port.js";
import { WeeklyReportReaderAdapter } from "./infrastructure/adapters/weekly-report-reader.adapter.js";
import { AiSuggestionQueueMaintenanceService } from "./infrastructure/jobs/ai-suggestion-queue-maintenance.scheduler.js";
import { SuggestionAnalysisProcessor } from "./infrastructure/jobs/suggestion-analysis.processor.js";
import { SuggestionAnalysisScheduler } from "./infrastructure/jobs/suggestion-analysis.scheduler.js";
import { DrizzleSuggestionRepository } from "./infrastructure/persistence/drizzle-suggestion.repository.js";
import { AiSuggestionController } from "./presentation/http/v1/ai-suggestion.controller.js";

/**
 * AI 반복 제안 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 사용자의 할 일 패턴을 AI가 분석하여 반복 할 일을 제안합니다.
 * 컨트롤러·프로세서는 필요한 UseCase를 직접 주입한다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회 / 제안 수락(반복 할 일 자동 생성)·거절
 * - 매일 KST 07:30 크론 → per-user 패턴 분석(pg-boss) → 새 제안 생성 + 알림
 *
 * ### 크로스모듈(전부 포트/어댑터로 역전)
 * - AiAssistanceGenerationModule: AI_GENERATOR(동의 범위 안의 업체 폴백)로 제안 생성
 * - AiAssistanceParsingModule: AI 데이터 처리 동의·앱 버전 reader
 * - PlanningTodosModule: 수락 시 STAGED_TODO_CREATOR로 같은 트랜잭션에 반복 할 일을 만들고 효과는 커밋 뒤 실행
 * - AiAssistanceReportsModule: WEEKLY_REPORT_READER가 최신 주간 보고서 인사이트 주입
 * - WeatherForecastsModule: 날씨 기반 제안을 위한 격자 예보 조회
 * - NotificationDeliveryModule: 새 제안 생성 시 알림 발송(프로세서)
 */
@Module({
  imports: [
    AccessModule,
    IdentityUserAccessModule,
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
    AiAssistanceReportsModule,
    NotificationDeliveryModule,
    PlanningTodosModule,
    WeatherForecastsModule,
  ],
  controllers: [AiSuggestionController],
  providers: [
    {
      provide: SUGGESTION_REPOSITORY,
      useClass: DrizzleSuggestionRepository,
    },
    { provide: WEEKLY_REPORT_READER, useClass: WeeklyReportReaderAdapter },
    suggestionContextReaderProvider,
    listPendingSuggestionsProvider,
    handleSuggestionActionProvider,
    analyzeAndCreateSuggestionsProvider,
    SuggestionAnalysisScheduler,
    SuggestionAnalysisProcessor,
    AiSuggestionQueueMaintenanceService,
  ],
})
export class AiAssistanceSuggestionsModule {}
