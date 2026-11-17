import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const ENTITLEMENT_CACHE_TTL_MS = 10 * 60_000;
export const EntitlementCacheKey = {
  // v2부터 리소스 보너스를 함께 담는다
  subscription: (userId: string) => cacheKey("subscription", "status", "v2", userId),
  subscriptionGeneration: (userId: string) => cacheKey("subscription", "status-generation", userId),
} as const;
