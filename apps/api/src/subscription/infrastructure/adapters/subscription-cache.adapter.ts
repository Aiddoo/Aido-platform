import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type { SubscriptionCachePort } from "../../application/ports/subscription-cache.port";

/**
 * 구독 캐시 무효화 어댑터.
 *
 * 구독 상태 변경 시 사용자 구독·프로필 캐시를 함께 무효화한다(키·TTL은 CacheService 소유).
 */
@Injectable()
export class SubscriptionCacheAdapter implements SubscriptionCachePort {
	constructor(private readonly cacheService: CacheService) {}

	async invalidate(userId: string): Promise<void> {
		await Promise.all([
			this.cacheService.invalidateSubscription(userId),
			this.cacheService.invalidateUserProfile(userId),
		]);
	}
}
