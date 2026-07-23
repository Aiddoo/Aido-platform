import type { WeatherCachePort } from "@/weather/application/ports/weather-cache.port";

/**
 * WeatherCachePort mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `jest.mocked(mock.method)`로 접근합니다.
 */
export function createWeatherCacheMock(): WeatherCachePort {
	return {
		getForecast: jest.fn(),
		saveForecast: jest.fn(),
		getLatestForecast: jest.fn(),
		getForecastBatch: jest.fn(),
		saveForecastBatch: jest.fn(),
		getLatestForecastBatch: jest.fn(),
		getConditions: jest.fn(),
		setConditions: jest.fn(),
		invalidateGrid: jest.fn(),
	};
}
