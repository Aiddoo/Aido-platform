import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { DAY_MS } from "#api/shared/domain/time/time-units";

export const DAILY_COMPLETION_CACHE_TTL_MS = 10 * 60_000;
export const DAILY_COMPLETION_GENERATION_TTL_MS = DAY_MS;

interface DailyCompletionKeyDates {
  readonly start: string;
  readonly end: string;
}

// range-v3: 완료율을 Math.round로 저장하던 이전 서버 값을 TTL 동안 그대로 내주지 않게 버전을 올렸다
export const DailyCompletionCacheKey = {
  generation: (userId: string) => cacheKey("daily-completion", "range-v1", userId, "generation"),
  range: (userId: string, generation: string, dates: DailyCompletionKeyDates) =>
    cacheKey("daily-completion", "range-v3", userId, generation, "own", dates.start, dates.end),
  publicRange: (userId: string, generation: string, dates: DailyCompletionKeyDates) =>
    cacheKey("daily-completion", "range-v3", userId, generation, "public", dates.start, dates.end),
} as const;
