import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  notificationInboxScopes,
  type NotificationInboxScope,
} from "../../../shared/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../../application/ports/notification-cache.port.js";
import { NotificationCacheKey, NOTIFICATION_CACHE_TTL_MS } from "./notification-cache.keyspace.js";

@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    this.#cacheService = cacheService;
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
}
