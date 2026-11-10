import { GRANTABLE_FEATURE_KEYS } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { EntitlementCacheInvalidatorPort } from "../../application/ports/entitlement-cache-invalidator.port.js";
import {
  EntitlementCachePort,
  type CachedAccessState,
} from "../../application/ports/entitlement-cache.port.js";
import {
  ENTITLEMENT_CACHE_TTL_MS,
  EntitlementCacheKey,
} from "../cache/entitlement-cache.keyspace.js";

const CACHED_ACCESS_STATE_SCHEMA = z.looseObject({
  status: z.string().nullable(),
  isAdmin: z.boolean(),
  accessDeadlineMs: z.number().nullable().optional(),
  resourceBonuses: z.partialRecord(z.enum(GRANTABLE_FEATURE_KEYS), z.number()),
}) satisfies z.ZodType<CachedAccessState>;

// 다른 Context(billing)가 비우는 문도 같은 key를 쓰므로 한 어댑터가 두 포트를 맡는다
@Injectable()
export class EntitlementCacheAdapter
  extends EntitlementCachePort
  implements EntitlementCacheInvalidatorPort
{
  readonly #cacheService: CacheService;

  constructor(cacheService: CacheService) {
    super();
    this.#cacheService = cacheService;
  }

  wrap(
    userId: UserId,
    factory: () => Promise<CachedAccessState>,
  ): Promise<CachedAccessState | null> {
    return this.#cacheService.wrap(
      EntitlementCacheKey.subscription(userId.value),
      CACHED_ACCESS_STATE_SCHEMA,
      factory,
      ENTITLEMENT_CACHE_TTL_MS,
    );
  }

  async invalidate(userId: UserId): Promise<void> {
    await this.invalidateEntitlements(userId.value);
  }

  async invalidateEntitlements(userId: string): Promise<void> {
    await this.#cacheService.del(EntitlementCacheKey.subscription(userId));
  }
}
