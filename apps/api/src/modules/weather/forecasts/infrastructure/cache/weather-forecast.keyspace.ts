import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const WEATHER_CACHE_TTL_MS = {
  FORECAST: 3 * 60 * 60_000,
  LATEST_FORECAST: 24 * 60 * 60_000,
  CONDITIONS: 60 * 60_000,
  FORECAST_FAILURE: 60_000,
} as const;

export const WeatherCacheKey = {
  /** 같은 발표라도 대상 날짜마다 정리한 예보가 다르므로 대상 날짜까지 키에 넣는다. */
  forecast: (
    gridX: number,
    gridY: number,
    baseDate: string,
    baseTime: string,
    targetDate: string,
  ) =>
    cacheKey("weather", "forecast", String(gridX), String(gridY), baseDate, baseTime, targetDate),
  latestForecast: (gridX: number, gridY: number) =>
    cacheKey("weather", "forecast-latest", String(gridX), String(gridY)),
  forecastFailure: (gridX: number, gridY: number) =>
    cacheKey("weather", "forecast-failure", String(gridX), String(gridY)),
  conditions: (gridX: number, gridY: number, localDate: string) =>
    cacheKey("weather", "conditions", String(gridX), String(gridY), localDate),
} as const;
