import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { DAY_MS } from "#api/shared/domain/time/time-units";

export const DAILY_COMPLETION_CACHE_TTL_MS = 10 * 60_000;
export const DAILY_COMPLETION_GENERATION_TTL_MS = DAY_MS;

interface DailyCompletionKeyDates {
  readonly start: string;
  readonly end: string;
}

export const DailyCompletionCacheKey = {
  generation: (userId: string) => cacheKey("daily-completion", "range-v1", userId, "generation"),
  range: (userId: string, generation: string, dates: DailyCompletionKeyDates) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "own", dates.start, dates.end),
  publicRange: (userId: string, generation: string, dates: DailyCompletionKeyDates) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "public", dates.start, dates.end),
} as const;
