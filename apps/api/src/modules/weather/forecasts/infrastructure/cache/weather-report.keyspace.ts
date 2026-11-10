import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";

const { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } = TIME_UNIT;

export const WEATHER_REPORT_CACHE_TTL_MS = {
  LATEST_REPORT: 6 * MS_PER_HOUR,
  AIR_QUALITY: MS_PER_HOUR,
  AVAILABILITY: 7 * MS_PER_DAY,
  PROVIDER_FAILURE: MS_PER_MINUTE,
  /** 가용성·표기 조회가 실패한 뒤 요청마다 시간 초과(3초)를 다시 기다리지 않도록 잠시 호출을 멈춘다. */
  AVAILABILITY_FAILURE: MS_PER_MINUTE,
  ATTRIBUTION: 7 * MS_PER_DAY,
  ATTRIBUTION_FAILURE: MS_PER_MINUTE,
} as const;

export const WeatherReportCacheKey = {
  report: (cell: string, scope: string) => cacheKey("weather", "v2", "report", cell, scope),
  latestReport: (cell: string, scope: string) =>
    cacheKey("weather", "v2", "report-latest", cell, scope),
  airQuality: (cell: string) => cacheKey("weather", "v2", "air-quality", cell),
  availability: (cell: string) => cacheKey("weather", "v2", "availability", cell),
  availabilityFailure: (cell: string) => cacheKey("weather", "v2", "availability-failure", cell),
  providerFailure: (cell: string) => cacheKey("weather", "v2", "provider-failure", cell),
  attribution: (language: string) => cacheKey("weather", "v2", "attribution", language),
  attributionFailure: (language: string) =>
    cacheKey("weather", "v2", "attribution-failure", language),
} as const;
