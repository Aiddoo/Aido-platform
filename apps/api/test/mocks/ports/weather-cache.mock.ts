import { vi } from "vitest";

import type { WeatherCachePort } from "#api/modules/weather/application/ports/forecast/weather-cache.port";

/**
 * WeatherCachePort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `vi.mocked(mock.method)`로 접근합니다.
 */
export function createWeatherCacheMock(): WeatherCachePort {
  return {
    getForecast: vi.fn(),
    saveForecast: vi.fn(),
    getLatestForecast: vi.fn(),
    getForecastBatch: vi.fn(),
    saveForecastBatch: vi.fn(),
    getLatestForecastBatch: vi.fn(),
    getConditions: vi.fn(),
    setConditions: vi.fn(),
    invalidateGrid: vi.fn(),
  };
}
