import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  type UserPreferenceCacheInvalidatorPort,
  UserSettingsCachePort,
} from "#api/modules/identity/identity-settings.public";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  notificationInboxScopes,
  type NotificationInboxScope,
} from "../../../push/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../../application/ports/notification-cache.port.js";
import { NotificationCacheKey, NOTIFICATION_CACHE_TTL_MS } from "./notification-cache.keyspace.js";

/** 알림 컨텍스트의 키·TTL을 사용해 공유 캐시를 연결한다. */
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
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

  wrapUnreadCount(
    userId: UserId,
    factory: () => Promise<number>,
    scope: NotificationInboxScope = "all",
  ): Promise<number> {
    return this.#cacheService.wrap(
      NotificationCacheKey.unreadCount(userId.value, scope),
      z.number(),
      factory,
      NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
    );
  }

  async invalidateUnreadCount(userId: UserId): Promise<void> {
    await Promise.all(
      notificationInboxScopes().map((scope) =>
        this.#cacheService.del(NotificationCacheKey.unreadCount(userId.value, scope)),
      ),
    );
  }

  invalidatePushTokens(userId: UserId): Promise<void> {
    return this.#cacheService.del(NotificationCacheKey.pushTokens(userId.value));
  }

  invalidateUserPreference(userId: UserId): Promise<void> {
    return this.#preferenceCache.invalidateUserPreference(userId);
  }
}
