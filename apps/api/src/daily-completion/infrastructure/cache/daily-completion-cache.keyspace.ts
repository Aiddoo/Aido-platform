import { cacheKey, cachePattern } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const DAILY_COMPLETION_CACHE_TTL_MS = 10 * 60_000;

export const DailyCompletionCacheKey = {
	range: (userId: string, startDate: string, endDate: string) =>
		cacheKey("daily-completion", "range-v1", userId, startDate, endDate),
	publicRange: (ownerUserId: string, startDate: string, endDate: string) =>
		cacheKey("daily-completion", "range-v1", ownerUserId, "public", startDate, endDate),
	pattern: (userId: string) => cachePattern("daily-completion", "range-v1", userId),
} as const;
