import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

// 키 문자열은 Redis에 남은 값과 같아야 해 옮기기 전 "follow" 접두사를 그대로 쓴다
export const FRIENDSHIP_CACHE_TTL_MS = {
  MUTUAL: 60_000,
  IDS: 5 * 60_000,
  COUNT: 5 * 60_000,
} as const;
export const FriendshipCacheKey = {
  mutual: (userId: string, targetUserId: string) =>
    cacheKey("follow", "mutual", userId, targetUserId),
  ids: (userId: string) => cacheKey("follow", "ids", userId),
  count: (userId: string) => cacheKey("follow", "count", userId),
} as const;
