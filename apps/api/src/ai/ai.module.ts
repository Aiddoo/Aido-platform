import { Module } from "@nestjs/common";

import { TodoCategoryModule } from "../todo-category/todo-category.module";
import { AI_PROVIDERS } from "./application/ai.providers";
import { AI_PROVIDER } from "./application/ports/ai-provider.port";
import { AI_USAGE_REPOSITORY } from "./application/ports/ai-usage.repository.port";
import { USER_CATEGORY_READER } from "./application/ports/user-category-reader.port";
import { AiUsageMeter } from "./application/services/ai-usage-meter.service";
import { AI_PROVIDER_GEMINI, AiRouterAdapter } from "./infrastructure/adapters/ai-router.adapter";
import { GeminiAiAdapter } from "./infrastructure/adapters/gemini-ai.adapter";
import { PrismaAiUsageRepository } from "./infrastructure/adapters/prisma-ai-usage.repository";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter";
import { AiUsageGuard } from "./infrastructure/guards/ai-usage.guard";
import { AiController } from "./presentation/ai.controller";

/**
 * AI 모듈 (클린아키텍처)
 *
 * 자연어 → 투두/메모 파싱과 월간 사용량 관리를 담당한다. AI 벤더(Gemini via
 * Vercel AI SDK)는 AI_PROVIDER 포트로 추상화되어 어댑터만 교체하면 벤더를 바꿀 수
 * 있다. 사용량 저장(User 컬럼)은 ai가 직접 소유하며, 카테고리 조회는 todo-category
 * 위임 어댑터로 접근한다.
 *
 * ### 주요 기능
 * - 자연어 → 투두 데이터 파싱 (스마트 시간 해석, 한국어 날짜 표현)
 * - 메모 → 다중 투두 + 서브투두 파싱
 * - 월간 사용량 제한 (무료 유저: 5회/월, KST 매월 1일 00:00 리셋)
 *
 * ### AI Provider
 * 모든 AI 경로(parse-todo, parse-memo, suggestion, report)는 **Gemini 3.1
 * Flash-Lite** 단일 모델을 사용한다. `AiRouterAdapter`는 향후 경로별 모델 추가를
 * 위한 라우팅 레이어다. 크로스 모듈(ai-report·ai-suggestion)은 AI_PROVIDER를 직접
 * 주입해 사용량 미터 없이 생성만 수행한다.
 *
 * ### 환경 변수
 * | 변수 | 필수 | 설명 |
 * |------|------|------|
 * | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI API 키 |
 */
@Module({
	imports: [TodoCategoryModule],
	controllers: [AiController],
	providers: [
		AiUsageGuard,
		AiUsageMeter,
		{ provide: AI_PROVIDER_GEMINI, useClass: GeminiAiAdapter },
		{ provide: AI_PROVIDER, useClass: AiRouterAdapter },
		{ provide: AI_USAGE_REPOSITORY, useClass: PrismaAiUsageRepository },
		{ provide: USER_CATEGORY_READER, useClass: TodoCategoryReaderAdapter },
		...AI_PROVIDERS,
	],
	exports: [AI_PROVIDER],
})
export class AiModule {}
