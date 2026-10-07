/**
 * Redis 모듈 DI 토큰
 */

/**
 * BullMQ 전용 연결 (maxRetriesPerRequest: null, 오프라인 큐 유지)
 *
 * 블로킹 명령을 쓰는 BullMQ 외에는 주입 금지 — 일반 명령에 쓰면
 * Redis 단절 시 명령이 오프라인 큐에서 무한 대기한다.
 */
export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

/**
 * 명령용 연결 (fail-fast: enableOfflineQueue false + commandTimeout)
 *
 * 캐시/락/스로틀/dedup/헬스 등 요청 경로의 일반 명령은 이 토큰을 사용한다.
 * Redis 단절 시 명령이 즉시 reject되어 소비처의 fail-open/fail-closed
 * 처리가 작동한다.
 */
export const REDIS_COMMAND_CLIENT = Symbol("REDIS_COMMAND_CLIENT");
