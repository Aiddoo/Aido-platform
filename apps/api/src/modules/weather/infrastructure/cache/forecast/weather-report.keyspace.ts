import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";

const { MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } = TIME_UNIT;

export const WEATHER_REPORT_CACHE_TTL_MS = {
  LATEST_REPORT: 6 * MS_PER_HOUR,
  AIR_QUALITY: MS_PER_HOUR,
  AVAILABILITY: 7 * MS_PER_DAY,
  PROVIDER_FAILURE: MS_PER_MINUTE,
  /** 여러 칸에 걸친 연속 장애가 이 시간 안에 이어질 때만 공급자 전체 장애로 센다. */
  PROVIDER_FAILURE_STREAK: 30 * MS_PER_SECOND,
  /** 공급자 전체 장애로 판단하면 모든 칸의 리포트 호출을 멈추는 시간. */
  PROVIDER_OUTAGE: MS_PER_MINUTE,
  /** 차단이 풀린 뒤 첫 실패는 바로 다시 차단하고, 성공하면 복구를 한 번 기록하도록 장애 기간을 기억한다. */
  PROVIDER_OUTAGE_EPISODE: 10 * MS_PER_MINUTE,
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
  providerFailureStreak: () => cacheKey("weather", "v2", "provider-failure-streak"),
  providerOutage: () => cacheKey("weather", "v2", "provider-outage"),
  attribution: (language: string) => cacheKey("weather", "v2", "attribution", language),
  attributionFailure: (language: string) =>
    cacheKey("weather", "v2", "attribution-failure", language),
} as const;
