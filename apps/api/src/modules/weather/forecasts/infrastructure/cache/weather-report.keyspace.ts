import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * 공급자 월 호출 한도를 아끼려고 평소에는 리포트를 30분 쓰고, 곧 비·눈이 오면(`isPrecipitationSoon`) 10분만 쓴다.
 * 강수가 임박했을 때만 "몇 분 뒤 비"가 바뀌므로 그때만 자주 받는다.
 */
export const WEATHER_REPORT_CACHE_TTL_MS = {
  REPORT_CALM: 30 * MS_PER_MINUTE,
  REPORT_PRECIPITATION_SOON: 10 * MS_PER_MINUTE,
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
