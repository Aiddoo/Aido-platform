import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const SESSION_CACHE_TTL_MS = 30_000;
// 폐기 세대가 폐기 전에 시작한 DB 읽기보다 오래 남아야 그 읽기의 늦은 저장이 세션을 되살리지 않는다
export const SESSION_GENERATION_TTL_MS = 2 * SESSION_CACHE_TTL_MS;
export const SessionCacheKey = {
  session: (sessionId: string) => cacheKey("auth", "session", sessionId),
  sessionGeneration: (sessionId: string) => cacheKey("auth", "session-generation", sessionId),
} as const;
