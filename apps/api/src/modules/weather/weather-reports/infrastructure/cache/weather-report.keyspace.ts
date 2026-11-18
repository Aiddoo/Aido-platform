import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * 공급자 월 호출 한도를 아끼려고 리포트는 공급자 예보 만료까지 두되 10~30분(모르면 30분)으로 자른다.
 * 분 단위 예보가 있는 곳에 곧 비·눈이 오면 "몇 분 뒤 비"가 바뀌므로 10분만 두고, 월 예산의 90%를 넘으면 2시간 둔다.
 */
export const WEATHER_REPORT_CACHE_TTL_MS = {
  REPORT_CALM: 30 * MS_PER_MINUTE,
  REPORT_PRECIPITATION_SOON: 10 * MS_PER_MINUTE,
  REPORT_BUDGET_SAVING: 2 * MS_PER_HOUR,
  LATEST_REPORT: 6 * MS_PER_HOUR,
  AIR_QUALITY: MS_PER_HOUR,
  /** 측정소가 측정값을 주지 않은 칸. 조회 실패는 저장하지 않는다 */
  AIR_QUALITY_NO_DATA: 30 * MS_PER_MINUTE,
  /** 칸에서 가장 가까운 측정소는 거의 바뀌지 않아 대기질 조회마다 다시 찾지 않는다 */
  AIRKOREA_STATION: 30 * MS_PER_DAY,
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
  airKoreaStation: (cell: string) => cacheKey("weather", "v2", "airkorea-station", cell),
  airKoreaFailure: (cell: string) => cacheKey("weather", "v2", "airkorea-failure", cell),
  availability: (cell: string) => cacheKey("weather", "v2", "availability", cell),
  availabilityFailure: (cell: string) => cacheKey("weather", "v2", "availability-failure", cell),
  providerFailure: (cell: string) => cacheKey("weather", "v2", "provider-failure", cell),
  attribution: (language: string) => cacheKey("weather", "v2", "attribution", language),
  attributionFailure: (language: string) =>
    cacheKey("weather", "v2", "attribution-failure", language),
} as const;
