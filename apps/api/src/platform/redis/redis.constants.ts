/**
 * 명령용 연결 (fail-fast: enableOfflineQueue false + commandTimeout)
 *
 * 캐시/락/스로틀/dedup/헬스 등 요청 경로의 일반 명령은 이 토큰을 사용한다.
 * Redis 단절 시 명령이 즉시 reject되어 소비처의 fail-open/fail-closed
 * 처리가 작동한다. 업무 포트가 아니라 ioredis 인스턴스라 Symbol 토큰으로 둔다.
 */
export const REDIS_COMMAND_CLIENT = Symbol("REDIS_COMMAND_CLIENT");
