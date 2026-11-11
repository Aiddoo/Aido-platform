/**
 * 스로틀 모듈 DI 토큰
 *
 * `@nestjs/throttler`의 `ThrottlerStorage` 인터페이스가 포트 역할을 한다.
 * Redis 사용 시 `RedisThrottlerStorage`, 아니면 undefined(기본 in-memory).
 * 라이브러리 인터페이스라 클래스 토큰이 없어 Symbol 토큰으로 둔다.
 */
export const THROTTLER_STORAGE = Symbol("THROTTLER_STORAGE");

/** 429 Swagger 설명. 응답 본문은 SYS_0001 오류 envelope다. */
export const THROTTLED_DESCRIPTION = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
