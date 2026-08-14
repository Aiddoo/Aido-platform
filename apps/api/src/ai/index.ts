/**
 * AI 모듈 공개 API
 *
 * Facade는 컨트롤러/가드 소비용, AI_PROVIDER 포트는 크로스 모듈(ai-report·
 * ai-suggestion)이 사용량 미터 없이 생성만 수행하기 위해 직접 주입한다.
 */

export * from "./ai.module";
export * from "./application/ports/ai-provider.port";
