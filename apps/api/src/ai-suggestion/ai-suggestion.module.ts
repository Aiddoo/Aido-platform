import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AiModule } from "../ai/ai.module";
import { AiReportModule } from "../ai-report/ai-report.module";
import { NotificationModule } from "../notification/notification.module";
import { TodoModule } from "../todo/todo.module";
import { WeatherModule } from "../weather/weather.module";

import { AiSuggestionController } from "./ai-suggestion.controller";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import { AiSuggestionService } from "./ai-suggestion.service";
import { SuggestionAnalysisJob } from "./jobs/suggestion-analysis.job";
import {
	AI_SUGGESTION_QUEUE,
	SuggestionAnalysisProcessor,
} from "./processors/suggestion-analysis.processor";
import { SuggestionContextBuilder } from "./suggestion-context.builder";

/**
 * AI 반복 제안 모듈
 *
 * 사용자의 할 일 패턴을 AI가 분석하여 반복 할 일을 제안합니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회
 * - 제안 수락 (반복 할 일 자동 생성) 또는 거절
 * - 크론 작업을 통한 주간 패턴 분석
 *
 * ### 의존성
 * - AiModule: AI Provider (Gemini)를 통한 제안 생성
 * - NotificationModule: 새 제안 생성 알림 발송
 * - CqrsModule: 제안 수락 시 CreateRecurringTodos 커맨드 디스패치
 * - TodoModule: 커맨드 핸들러 등록 보장 (명시적 의존)
 * - WeatherModule: 날씨 기반 제안을 위한 날씨 조회
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
		AiSuggestionRepository,
		AiSuggestionService,
		SuggestionContextBuilder,
		SuggestionAnalysisJob,
		SuggestionAnalysisProcessor,
	],
	exports: [AiSuggestionService],
})
export class AiSuggestionModule {}
