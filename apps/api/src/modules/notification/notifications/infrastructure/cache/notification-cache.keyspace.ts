import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

import type { NotificationInboxScope } from "../../../shared/domain/notification-client-capability.domain-service.js";

export const NOTIFICATION_CACHE_TTL_MS = {
  UNREAD_COUNT: 2 * 60_000,
} as const;

export const NotificationCacheKey = {
  unreadCount: (userId: string, scope: NotificationInboxScope = "all") =>
    scope === "all"
      ? cacheKey("notification", "unread-count", userId)
      : cacheKey("notification", "unread-count", userId, scope),
  // 두 범위의 미읽음 수가 한 세대를 함께 쓴다
  unreadCountGeneration: (userId: string) =>
    cacheKey("notification", "unread-count-generation", userId),
} as const;
