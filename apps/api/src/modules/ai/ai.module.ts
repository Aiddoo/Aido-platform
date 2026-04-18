import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TodoCategoryModule } from "../todo-category/todo-category.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiUsageGuard } from "./guards/ai-usage.guard";
import { AI_PROVIDER } from "./providers/ai.provider";
import {
	AI_PROVIDER_GEMINI,
	AiRouterProvider,
} from "./providers/ai-router.provider";
import { GeminiProvider } from "./providers/gemini.provider";

/**
 * AI 모듈
 *
 * AI 기반 자연어 처리 기능을 제공합니다.
 *
 * ### 주요 기능
 * - 자연어 → 투두 데이터 파싱
 * - 스마트 시간 해석 (현재 시간 기반)
 * - 한국어 날짜 표현 처리
 * - 월간 사용량 제한 (무료 유저: 5회/월, KST 매월 1일 00:00 리셋)
 *
 * ### AI Provider
 * 모든 AI 경로(parse-todo, parse-memo, suggestion, report)는 **Gemini 2.5 Flash-Lite**
 * 단일 모델을 사용합니다. `AiRouterProvider`는 향후 경로별 모델 추가를 위한
 * 라우팅 레이어로 남겨둡니다.
 * - Input: $0.10/1M tokens, Output: $0.40/1M tokens
 *
 * ### 환경 변수
 * | 변수 | 필수 | 설명 |
 * |------|------|------|
 * | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI API 키 |
 */
@Module({
	imports: [AuthModule, TodoCategoryModule],
	controllers: [AiController],
	providers: [
		AiService,
		AiUsageGuard,
		{ provide: AI_PROVIDER_GEMINI, useClass: GeminiProvider },
		{
			provide: AI_PROVIDER,
			useClass: AiRouterProvider,
		},
	],
	exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
