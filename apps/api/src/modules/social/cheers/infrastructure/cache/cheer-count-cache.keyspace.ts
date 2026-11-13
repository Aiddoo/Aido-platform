import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const CHEER_COUNT_CACHE_TTL_MS = 60_000;

export const CheerCountCacheKey = {
  received: (userId: string) => cacheKey("cheer", "received-counts", userId),
  sent: (userId: string) => cacheKey("cheer", "sent-count", userId),
} as const;
