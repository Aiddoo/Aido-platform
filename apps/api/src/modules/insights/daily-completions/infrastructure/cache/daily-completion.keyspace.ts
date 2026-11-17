import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { DAY_MS } from "#api/shared/domain/time/time-units";

export const DAILY_COMPLETION_CACHE_TTL_MS = 10 * 60_000;
export const DAILY_COMPLETION_GENERATION_TTL_MS = DAY_MS;

export const DailyCompletionCacheKey = {
  generation: (userId: string) => cacheKey("daily-completion", "range-v1", userId, "generation"),
  range: (userId: string, generation: string, startDate: string, endDate: string) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "own", startDate, endDate),
  publicRange: (userId: string, generation: string, startDate: string, endDate: string) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "public", startDate, endDate),
} as const;
