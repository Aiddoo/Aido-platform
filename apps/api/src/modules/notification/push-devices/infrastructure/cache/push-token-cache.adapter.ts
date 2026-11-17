import { Inject, Injectable } from "@nestjs/common";

import {
  type UserPreferenceCacheInvalidatorPort,
  UserSettingsCachePort,
} from "#api/modules/identity/identity-settings.public";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushTokenCachePort } from "../../application/ports/push-token-cache.port.js";
import { PushTokenCacheKey } from "./push-token-cache.keyspace.js";

@Injectable()
export class PushTokenCacheAdapter implements PushTokenCachePort {
  readonly #cacheService: CacheStorePort;
  readonly #preferenceCache: UserPreferenceCacheInvalidatorPort;

  constructor(
    cacheService: CacheStorePort,
    @Inject(UserSettingsCachePort)
    preferenceCache: UserPreferenceCacheInvalidatorPort,
  ) {
    this.#cacheService = cacheService;
    this.#preferenceCache = preferenceCache;
  }

  invalidatePushTokens(userId: UserId): Promise<void> {
    return this.#cacheService.del(PushTokenCacheKey.pushTokens(userId.value));
  }

  invalidateUserPreference(userId: UserId): Promise<void> {
    return this.#preferenceCache.invalidateUserPreference(userId);
  }
}
