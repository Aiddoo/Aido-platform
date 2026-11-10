import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  type UserPreferenceCacheInvalidatorPort,
  UserSettingsCachePort,
} from "#api/modules/identity/identity-settings.public";
import { CacheService } from "#api/platform/cache/cache.service";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  notificationInboxScopes,
  type NotificationInboxScope,
} from "../../../push/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../../application/ports/notification-cache.port.js";
import { NotificationCacheKey, NOTIFICATION_CACHE_TTL_MS } from "./notification-cache.keyspace.js";

/** 알림 컨텍스트의 키·TTL을 사용해 공유 캐시를 연결한다. */
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
  readonly #cacheService: CacheService;
  readonly #preferenceCache: UserPreferenceCacheInvalidatorPort;

  constructor(
    cacheService: CacheService,
    @Inject(UserSettingsCachePort)
    preferenceCache: UserPreferenceCacheInvalidatorPort,
  ) {
    this.#cacheService = cacheService;
    this.#preferenceCache = preferenceCache;
  }

  wrapUnreadCount(
    userId: string,
    factory: () => Promise<number>,
    scope: NotificationInboxScope = "all",
  ): Promise<number> {
    return this.#cacheService.wrap(
      NotificationCacheKey.unreadCount(userId, scope),
      z.number(),
      factory,
      NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
    );
  }

  async invalidateUnreadCount(userId: string): Promise<void> {
    await Promise.all(
      notificationInboxScopes().map((scope) =>
        this.#cacheService.del(NotificationCacheKey.unreadCount(userId, scope)),
      ),
    );
  }

  invalidatePushTokens(userId: string): Promise<void> {
    return this.#cacheService.del(NotificationCacheKey.pushTokens(userId));
  }

  invalidateUserPreference(userId: string): Promise<void> {
    return this.#preferenceCache.invalidateUserPreference(UserId.reconstitute(userId));
  }
}
