import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const SESSION_CACHE_TTL_MS = 30_000;
// 폐기 표시가 늦게 쓴 세션 값보다 오래 남아야 폐기 뒤 늦게 도착한 쓰기가 세션을 되살리지 않는다
export const SESSION_INVALIDATION_TTL_MS = 2 * SESSION_CACHE_TTL_MS;
export const SessionCacheKey = {
  session: (sessionId: string) => cacheKey("auth", "session", sessionId),
  invalidated: (sessionId: string) => cacheKey("auth", "session-invalidated", sessionId),
} as const;
