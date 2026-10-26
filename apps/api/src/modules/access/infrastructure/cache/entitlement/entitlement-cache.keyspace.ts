import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const ENTITLEMENT_CACHE_TTL_MS = 10 * 60_000;
export const EntitlementCacheKey = {
  // v2부터 리소스 보너스를 함께 담는다
  subscription: (userId: string) => cacheKey("subscription", "status", "v2", userId),
  /** 배포 전환 중 이전 형식을 읽는 서버가 남아 있을 수 있어 무효화할 때 함께 지운다. */
  legacySubscription: (userId: string) => cacheKey("subscription", "status", userId),
} as const;
