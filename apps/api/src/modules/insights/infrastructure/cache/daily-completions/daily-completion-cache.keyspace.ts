import { cacheKey, cachePattern } from "#api/platform/cache/keyspace/cache-key";

export const DAILY_COMPLETION_CACHE_TTL_MS = 10 * 60_000;
export const DAILY_COMPLETION_GENERATION_TTL_MS = 86_400_000;

export const DailyCompletionCacheKey = {
  generation: (userId: string) => cacheKey("daily-completion", "range-v1", userId, "generation"),
  range: (userId: string, generation: string, startDate: string, endDate: string) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "own", startDate, endDate),
  publicRange: (userId: string, generation: string, startDate: string, endDate: string) =>
    cacheKey("daily-completion", "range-v2", userId, generation, "public", startDate, endDate),
  generationPattern: (userId: string, generation: string) =>
    cachePattern("daily-completion", "range-v2", userId, generation),
  // 이전 인스턴스의 prefix 무효화도 generation을 끊도록 기존 namespace를 공유한다.
  legacyPattern: (userId: string) => cachePattern("daily-completion", "range-v1", userId),
} as const;
