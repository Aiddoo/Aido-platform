import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const ENTITLEMENT_CACHE_TTL_MS = 10 * 60_000;
export const EntitlementCacheKey = {
  subscription: (userId: string) => cacheKey("subscription", "status", userId),
} as const;
