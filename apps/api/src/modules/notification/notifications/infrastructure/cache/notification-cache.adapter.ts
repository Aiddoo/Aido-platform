import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  notificationInboxScopes,
  type NotificationInboxScope,
} from "../../../shared/domain/notification-client-capability.domain-service.js";
import type { NotificationCachePort } from "../../application/ports/notification-cache.port.js";
import { NotificationCacheKey, NOTIFICATION_CACHE_TTL_MS } from "./notification-cache.keyspace.js";

function unreadCountKey(userId: UserId, scope: NotificationInboxScope): GenerationGuardedCacheKey {
  return {
    valueKey: NotificationCacheKey.unreadCount(userId.value, scope),
    generationKey: NotificationCacheKey.unreadCountGeneration(userId.value),
  };
}

// 알림 저장·읽음의 커밋 전에 센 수가 무효화 뒤 다시 저장되지 않도록 세대를 확인한다
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
  readonly #unreadCounts: GenerationGuardedCache;

  constructor(cacheService: CacheStorePort) {
    this.#unreadCounts = new GenerationGuardedCache(
      cacheService,
      NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
    );
  }

  wrapUnreadCount(
    userId: UserId,
    factory: () => Promise<number>,
    scope: NotificationInboxScope = "all",
  ): Promise<number> {
    return this.#unreadCounts.wrap(
      unreadCountKey(userId, scope),
      z.number(),
      factory,
      NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
    );
  }

  async invalidateUnreadCount(userId: UserId): Promise<void> {
    await Promise.all(
      notificationInboxScopes().map((scope) =>
        this.#unreadCounts.invalidate(unreadCountKey(userId, scope)),
      ),
    );
  }
}
