import { Injectable } from "@nestjs/common";

import { UserSettingsCacheKey } from "#api/modules/identity/infrastructure/cache/settings/user-settings-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { NotificationCachePort } from "../../../application/ports/delivery/notification-cache.port.js";
import type { NotificationInboxScope } from "../../../domain/services/delivery/notification-client-capability.js";
import {
  NotificationCacheKey,
  NOTIFICATION_CACHE_TTL_MS,
} from "../../cache/delivery/notification-cache.keyspace.js";

/** 알림 컨텍스트의 키·TTL을 사용해 공유 캐시를 연결한다. */
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
  constructor(private readonly cacheService: CacheService) {}

  wrapUnreadCount(
    userId: string,
    factory: () => Promise<number>,
    scope: NotificationInboxScope = "all",
  ): Promise<number> {
    return this.cacheService.wrap(
      NotificationCacheKey.unreadCount(userId, scope),
      factory,
      NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
    );
  }

  async invalidateUnreadCount(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(NotificationCacheKey.unreadCount(userId)),
      this.cacheService.del(NotificationCacheKey.unreadCount(userId, "legacy")),
    ]);
  }

  invalidatePushTokens(userId: string): Promise<void> {
    return this.cacheService.del(NotificationCacheKey.pushTokens(userId));
  }

  invalidateUserPreference(userId: string): Promise<void> {
    return this.cacheService.del(UserSettingsCacheKey.preference(userId));
  }
}
