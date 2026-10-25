import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import type {
  CachedSubscriptionState,
  EntitlementCachePort,
} from "../../../application/ports/entitlement/entitlement-cache.port.js";
import type { EntitlementSubscriptionInvalidatorPort } from "../../../application/ports/entitlement/subscription-cache-invalidator.port.js";
import {
  ENTITLEMENT_CACHE_TTL_MS,
  EntitlementCacheKey,
} from "../../cache/entitlement/entitlement-cache.keyspace.js";

@Injectable()
export class EntitlementCacheAdapter
  implements EntitlementCachePort, EntitlementSubscriptionInvalidatorPort
{
  constructor(private readonly cacheService: CacheService) {}

  async invalidateSubscription(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(EntitlementCacheKey.subscription(userId)),
      this.cacheService.del(EntitlementCacheKey.legacySubscription(userId)),
    ]);
  }

  wrapSubscription(
    userId: string,
    factory: () => Promise<CachedSubscriptionState>,
  ): Promise<CachedSubscriptionState | null> {
    return this.cacheService.wrap(
      EntitlementCacheKey.subscription(userId),
      factory,
      ENTITLEMENT_CACHE_TTL_MS,
    );
  }
}
