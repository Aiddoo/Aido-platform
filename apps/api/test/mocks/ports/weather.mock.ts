import type { AirQualityProvider } from "@/weather/application/ports/air-quality-provider.port";
import type { LifestyleIndexProvider } from "@/weather/application/ports/lifestyle-index-provider.port";
import type { SunTimeProvider } from "@/weather/application/ports/sun-time-provider.port";
import type { WeatherLocationRepositoryPort } from "@/weather/application/ports/weather-location.repository.port";

/**
 * 날씨 도메인 Symbol 토큰 포트 mock 팩토리 모음.
 *
 * @suites/unit은 Symbol 토큰 주입 포트를 auto-mock하지 못하므로 명시적 팩토리를 둡니다.
 * (WEATHER_CACHE는 weather-cache.mock, WEATHER_PROVIDER는 WeatherForecastReader
 * 내부 의존이라 쿼리 spec에서는 클래스 auto-mock으로 대체되어 여기 없음)
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는 `jest.mocked(mock.method)`로 접근합니다.
 */

/** WEATHER_LOCATION_REPOSITORY 포트 mock */
export function createWeatherLocationRepositoryMock(): WeatherLocationRepositoryPort {
	return {
		findByUserId: jest.fn(),
		upsert: jest.fn(),
	};
}

/** AIR_QUALITY_PROVIDER 포트 mock */
export function createAirQualityProviderMock(): AirQualityProvider {
	return {
		getAirQuality: jest.fn(),
	};
}

/** LIFESTYLE_INDEX_PROVIDER 포트 mock */
export function createLifestyleIndexProviderMock(): LifestyleIndexProvider {
	return {
		getIndex: jest.fn(),
	};
}

/** SUN_TIME_PROVIDER 포트 mock */
export function createSunTimeProviderMock(): SunTimeProvider {
	return {
		getSunTime: jest.fn(),
	};
}
