import { cacheKey } from "#api/shared/infrastructure/cache/keyspace/cache-key";

import type { NotificationInboxScope } from "../../domain/services/notification-client-capability.js";

export const NOTIFICATION_CACHE_TTL_MS = {
	PUSH_TOKENS: 5 * 60_000,
	UNREAD_COUNT: 2 * 60_000,
} as const;

export const NotificationCacheKey = {
	pushTokens: (userId: string) => cacheKey("notification", "push-tokens", userId),
	unreadCount: (userId: string, scope: NotificationInboxScope = "all") =>
		scope === "all"
			? cacheKey("notification", "unread-count", userId)
			: cacheKey("notification", "unread-count", userId, scope),
} as const;
