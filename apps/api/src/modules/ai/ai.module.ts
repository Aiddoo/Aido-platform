import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TodoCategoryModule } from "../todo-category/todo-category.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiUsageGuard } from "./guards/ai-usage.guard";
import { AI_PROVIDER } from "./providers/ai.provider";
import {
	AI_PROVIDER_ANTHROPIC,
	AI_PROVIDER_GEMINI,
	AiRouterProvider,
} from "./providers/ai-router.provider";
import { AnthropicProvider } from "./providers/anthropic.provider";
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
 * ### AI Provider 라우팅
 * - 기본 경로(parse-todo, parse-memo, suggestion): **Gemini 2.5 Flash-Lite**
 *   - Input: $0.10/1M tokens, Output: $0.40/1M tokens
 * - 리포트 경로(`modelHint: "report"`): **Claude Sonnet 4.6** (Anthropic)
 *   - `ANTHROPIC_API_KEY` 미설정 시 Gemini로 자동 fallback
 *
 * ### 환경 변수
 * | 변수 | 필수 | 설명 |
 * |------|------|------|
 * | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI API 키 |
 * | `ANTHROPIC_API_KEY` | ⚠️ 권장 | 리포트 품질 상향용. 미설정 시 Gemini fallback |
 */
@Module({
	imports: [AuthModule, TodoCategoryModule],
	controllers: [AiController],
	providers: [
		AiService,
		AiUsageGuard,
		{ provide: AI_PROVIDER_GEMINI, useClass: GeminiProvider },
		{ provide: AI_PROVIDER_ANTHROPIC, useClass: AnthropicProvider },
		{
			provide: AI_PROVIDER,
			useClass: AiRouterProvider,
		},
	],
	exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
