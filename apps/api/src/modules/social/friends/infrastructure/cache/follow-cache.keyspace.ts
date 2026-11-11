import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const FOLLOW_CACHE_TTL_MS = { MUTUAL: 60_000, IDS: 5 * 60_000, COUNT: 5 * 60_000 } as const;
export const FollowCacheKey = {
  mutual: (userId: string, targetUserId: string) =>
    cacheKey("follow", "mutual", userId, targetUserId),
  ids: (userId: string) => cacheKey("follow", "ids", userId),
  count: (userId: string) => cacheKey("follow", "count", userId),
} as const;
