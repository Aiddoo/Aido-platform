import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

import type {
  CachedSubscriptionState,
  EntitlementCachePort,
} from "../../../application/services/entitlement/entitlement-state.port.js";
import {
  ENTITLEMENT_CACHE_TTL_MS,
  EntitlementCacheKey,
} from "../../cache/entitlement/entitlement-cache.keyspace.js";

@Injectable()
export class EntitlementCacheAdapter implements EntitlementCachePort {
  constructor(private readonly cacheService: CacheService) {}

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
