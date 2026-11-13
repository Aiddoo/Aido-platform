import { GRANTABLE_FEATURE_KEYS } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { EntitlementCacheInvalidatorPort } from "../../application/ports/entitlement-cache-invalidator.port.js";
import type {
  CachedAccessState,
  EntitlementCachePort,
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

function subscriptionKey(userId: UserId): GenerationGuardedCacheKey {
  return {
    valueKey: EntitlementCacheKey.subscription(userId.value),
    generationKey: EntitlementCacheKey.subscriptionGeneration(userId.value),
  };
}

// 다른 Context(billing)가 비우는 문도 같은 key를 쓰므로 한 어댑터가 두 포트를 맡는다
@Injectable()
export class EntitlementCacheAdapter
  implements EntitlementCachePort, EntitlementCacheInvalidatorPort
{
  readonly #cache: GenerationGuardedCache;

  constructor(cacheService: CacheStorePort) {
    this.#cache = new GenerationGuardedCache(cacheService, ENTITLEMENT_CACHE_TTL_MS);
  }

  wrap(
    userId: UserId,
    factory: () => Promise<CachedAccessState>,
  ): Promise<CachedAccessState | null> {
    return this.#cache.wrap(
      subscriptionKey(userId),
      CACHED_ACCESS_STATE_SCHEMA,
      factory,
      ENTITLEMENT_CACHE_TTL_MS,
    );
  }

  async invalidate(userId: UserId): Promise<void> {
    await this.invalidateEntitlements(userId);
  }

  async invalidateEntitlements(userId: UserId): Promise<void> {
    await this.#cache.invalidate(subscriptionKey(userId));
  }
}
