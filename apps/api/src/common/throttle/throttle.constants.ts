/**
 * 스로틀 모듈 DI 토큰
 *
 * `@nestjs/throttler`의 `ThrottlerStorage` 인터페이스가 포트 역할을 한다.
 * Redis 사용 시 `RedisThrottlerStorage`, 아니면 undefined(기본 in-memory).
 */
export const THROTTLER_STORAGE = Symbol("THROTTLER_STORAGE");
