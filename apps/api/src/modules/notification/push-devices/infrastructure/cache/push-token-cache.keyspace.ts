import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const PUSH_TOKEN_CACHE_TTL_MS = {
  PUSH_TOKENS: 5 * 60_000,
} as const;

export const PushTokenCacheKey = {
  pushTokens: (userId: string) => cacheKey("notification", "push-tokens", userId),
} as const;
