import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const WEATHER_REPORT_CACHE_TTL_MS = {
  REPORT: 15 * 60_000,
  LATEST_REPORT: 6 * 60 * 60_000,
  AIR_QUALITY: 60 * 60_000,
  AVAILABILITY: 7 * 24 * 60 * 60_000,
} as const;

export const WeatherReportCacheKey = {
  report: (cell: string, language: string) => cacheKey("weather", "v2", "report", cell, language),
  latestReport: (cell: string, language: string) =>
    cacheKey("weather", "v2", "report-latest", cell, language),
  airQuality: (cell: string) => cacheKey("weather", "v2", "air-quality", cell),
  availability: (cell: string) => cacheKey("weather", "v2", "availability", cell),
} as const;
