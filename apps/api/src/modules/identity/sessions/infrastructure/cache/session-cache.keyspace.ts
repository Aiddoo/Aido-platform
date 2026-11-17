import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const SESSION_CACHE_TTL_MS = 30_000;
export const SessionCacheKey = {
  session: (sessionId: string) => cacheKey("auth", "session", sessionId),
} as const;
