import { Injectable } from "@nestjs/common";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { GenerationGuardedCache } from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushTokenCachePort } from "../../application/ports/push-token-cache.port.js";
import { PUSH_TOKEN_CACHE_TTL_MS, pushTokensCacheKey } from "./push-token-cache.keyspace.js";

@Injectable()
export class PushTokenCacheAdapter implements PushTokenCachePort {
  readonly #pushTokens: GenerationGuardedCache;

  constructor(cacheService: CacheStorePort) {
    this.#pushTokens = new GenerationGuardedCache(
      cacheService,
      PUSH_TOKEN_CACHE_TTL_MS.PUSH_TOKENS,
    );
  }

  invalidatePushTokens(userId: UserId): Promise<void> {
    return this.#pushTokens.invalidate(pushTokensCacheKey(userId.value));
  }
}
