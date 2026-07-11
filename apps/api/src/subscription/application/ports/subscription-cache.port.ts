export const SUBSCRIPTION_CACHE = Symbol("SUBSCRIPTION_CACHE");

/**
 * 구독 캐시 무효화 포트.
 *
 * 구독 상태 변경 시 사용자 구독·프로필 캐시를 무효화한다(키·TTL은 CacheService가 소유).
 */
export interface SubscriptionCachePort {
	invalidate(userId: string): Promise<void>;
}
