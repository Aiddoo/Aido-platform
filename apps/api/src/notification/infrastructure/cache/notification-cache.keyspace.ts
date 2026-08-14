import { cacheKey } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const NOTIFICATION_CACHE_TTL_MS = { PUSH_TOKENS: 5 * 60_000 } as const;

export const NotificationCacheKey = {
	pushTokens: (userId: string) =>
		cacheKey("notification", "push-tokens", userId),
} as const;
