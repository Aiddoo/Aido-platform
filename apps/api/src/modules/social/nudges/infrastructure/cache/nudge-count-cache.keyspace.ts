import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const NUDGE_COUNT_CACHE_TTL_MS = 60_000;

export const NudgeCountCacheKey = {
  received: (userId: string) => cacheKey("nudge", "received-counts", userId),
  sent: (userId: string) => cacheKey("nudge", "sent-count", userId),
} as const;
