import { Injectable } from "@nestjs/common";

import { EntitlementCacheKey } from "#api/modules/access/infrastructure/cache/entitlement/entitlement-cache.keyspace";
import { IdentityCacheKey } from "#api/modules/identity/infrastructure/cache/auth/identity-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { SubscriptionCachePort } from "../../../application/ports/subscriptions/subscription-cache.port.js";

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
      this.cacheService.del(EntitlementCacheKey.subscription(userId)),
      this.cacheService.del(IdentityCacheKey.userProfile(userId)),
    ]);
  }
}
