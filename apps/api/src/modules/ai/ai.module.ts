import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiUsageGuard } from "./guards/ai-usage.guard";
import { AI_PROVIDER } from "./providers/ai.provider";
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
 * - 일일 사용량 제한 (무료 유저: 5회/일)
 *
 * ### AI Provider
 * Google Gemini 2.5 Flash-Lite를 사용하여 비용 효율적인 AI 처리:
 * - Input: $0.10/1M 토큰
 * - Output: $0.40/1M 토큰
 * - 예시 원가(파싱 1회 input 180 / output 45 기준): 약 $0.000036 / 회
 * - 예시 월 원가(1,000명 x 5회/일 x 30일): 약 $5.40 / 월
 * 출처: https://ai.google.dev/gemini-api/docs/pricing
 *
 * ### 환경 변수
 * | 변수 | 필수 | 설명 |
 * |------|------|------|
 * | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI API 키 |
 */
@Module({
	imports: [AuthModule],
	controllers: [AiController],
	providers: [
		AiService,
		AiUsageGuard,
		{
			provide: AI_PROVIDER,
			useClass: GeminiProvider,
		},
	],
	exports: [AiService, AI_PROVIDER],
})
export class AiModule {}
