import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AiModule } from "../ai/ai.module";
import { AiReportModule } from "../ai-report/ai-report.module";
import { NotificationModule } from "../notification/notification.module";
import { TodoModule } from "../todo/todo.module";
import { WeatherModule } from "../weather/weather.module";

import { AiSuggestionFacade } from "./application/facades/ai-suggestion.facade";
import { AI_SUGGESTION_REPOSITORY } from "./application/ports/ai-suggestion.repository.port";
import { RECURRING_TODO_CREATOR } from "./application/ports/recurring-todo-creator.port";
import { WEEKLY_REPORT_READER } from "./application/ports/weekly-report-reader.port";
import { SuggestionContextBuilder } from "./application/services/suggestion-context.builder";
import { AnalyzeAndCreateSuggestionsUseCase } from "./application/use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case";
import { GetPendingSuggestionsUseCase } from "./application/use-cases/get-pending-suggestions/get-pending-suggestions.use-case";
import { HandleSuggestionActionUseCase } from "./application/use-cases/handle-suggestion-action/handle-suggestion-action.use-case";
import { RecurringTodoCreatorAdapter } from "./infrastructure/adapters/recurring-todo-creator.adapter";
import { WeeklyReportReaderAdapter } from "./infrastructure/adapters/weekly-report-reader.adapter";
import { SuggestionAnalysisJob } from "./infrastructure/jobs/suggestion-analysis.job";
import { PrismaAiSuggestionRepository } from "./infrastructure/persistence/prisma-ai-suggestion.repository";
import { SuggestionAnalysisProcessor } from "./infrastructure/processors/suggestion-analysis.processor";
import { AI_SUGGESTION_QUEUE } from "./infrastructure/queue/ai-suggestion-queue";
import { AiSuggestionController } from "./presentation/ai-suggestion.controller";

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
 * - TodoModule: 수락 시 RECURRING_TODO_CREATOR가 CreateRecurringTodos 커맨드 디스패치
 * - AiReportModule: WEEKLY_REPORT_READER가 최신 주간 보고서 인사이트 주입
 * - WeatherModule: 날씨 기반 제안을 위한 격자 예보 조회
 * - NotificationModule: 새 제안 생성 시 알림 발송(프로세서)
 */
@Module({
	imports: [
		CqrsModule,
		AiModule,
		AiReportModule,
		NotificationModule,
		TodoModule,
		WeatherModule,
		BullModule.registerQueue({ name: AI_SUGGESTION_QUEUE }),
	],
	controllers: [AiSuggestionController],
	providers: [
		{
			provide: AI_SUGGESTION_REPOSITORY,
			useClass: PrismaAiSuggestionRepository,
		},
		{ provide: RECURRING_TODO_CREATOR, useClass: RecurringTodoCreatorAdapter },
		{ provide: WEEKLY_REPORT_READER, useClass: WeeklyReportReaderAdapter },
		SuggestionContextBuilder,
		GetPendingSuggestionsUseCase,
		HandleSuggestionActionUseCase,
		AnalyzeAndCreateSuggestionsUseCase,
		AiSuggestionFacade,
		SuggestionAnalysisJob,
		SuggestionAnalysisProcessor,
	],
	exports: [AiSuggestionFacade],
})
export class AiSuggestionModule {}
