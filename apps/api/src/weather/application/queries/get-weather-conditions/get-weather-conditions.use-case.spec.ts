/**
 * GetWeatherConditionsUseCase 단위 테스트
 *
 * - 위치 조회 → conditions 캐시(1h) 확인 → 현재 기온/풍속 산출 → 3개 프로바이더 병렬 조회 → 병합 → 캐시 저장
 * - 병합은 Promise.allSettled 기반: 실패한 프로바이더의 필드는 null로 강등(graceful degradation)
 * - 예보 조회 실패 시 lifestyle 계산 입력은 기본값(0, 0)으로 폴백
 */
import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createWeatherCacheMock } from "@test/mocks/ports/weather-cache.mock";
import {
	createAirQualityProviderMock,
	createLifestyleIndexProviderMock,
	createSunTimeProviderMock,
	createWeatherLocationRepositoryMock,
} from "@test/mocks/ports/weather.mock";

import { UserLocation } from "../../../domain/entities/user-location.entity";
import {
	AIR_QUALITY_PROVIDER,
	type AirQualityProvider,
} from "../../ports/air-quality-provider.port";
import {
	LIFESTYLE_INDEX_PROVIDER,
	type LifestyleIndexProvider,
} from "../../ports/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER, type SunTimeProvider } from "../../ports/sun-time-provider.port";
import { WEATHER_CACHE, type WeatherCachePort } from "../../ports/weather-cache.port";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import type { WeatherForecast } from "../../ports/weather-provider.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";
import { GetWeatherConditionsUseCase } from "./get-weather-conditions.use-case";

function buildForecast(): WeatherForecast {
	return {
		date: new Date("2026-07-23T00:00:00.000Z"),
		skyCondition: "CLEAR",
		precipitationType: "NONE",
		precipitationProbability: 0,
		temperatureMin: 20,
		temperatureMax: 28,
		humidity: 55,
		windSpeed: 4,
		hourlyForecasts: [],
		dailyForecasts: [],
	};
}

describe("GetWeatherConditionsUseCase — 날씨 부가정보(체감·자외선·일출입·미세먼지) 조회", () => {
	let useCase: GetWeatherConditionsUseCase;
	let repository: Mocked<WeatherLocationRepositoryPort>;
	let airQualityProvider: Mocked<AirQualityProvider>;
	let lifestyleIndexProvider: Mocked<LifestyleIndexProvider>;
	let sunTimeProvider: Mocked<SunTimeProvider>;
	let forecastReader: Mocked<WeatherForecastReader>;
	let cache: Mocked<WeatherCachePort>;

	const date = new Date("2026-07-23T09:00:00.000Z");
	const location = UserLocation.reconstitute({
		userId: "user-123",
		latitude: 37.5665,
		longitude: 126.978,
		gridX: 60,
		gridY: 127,
	});
	const input = { userId: "user-123", date };

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetWeatherConditionsUseCase)
			.mock<WeatherLocationRepositoryPort>(WEATHER_LOCATION_REPOSITORY)
			.impl(() => createWeatherLocationRepositoryMock())
			.mock<AirQualityProvider>(AIR_QUALITY_PROVIDER)
			.impl(() => createAirQualityProviderMock())
			.mock<LifestyleIndexProvider>(LIFESTYLE_INDEX_PROVIDER)
			.impl(() => createLifestyleIndexProviderMock())
			.mock<SunTimeProvider>(SUN_TIME_PROVIDER)
			.impl(() => createSunTimeProviderMock())
			.mock<WeatherCachePort>(WEATHER_CACHE)
			.impl(() => createWeatherCacheMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<WeatherLocationRepositoryPort>(WEATHER_LOCATION_REPOSITORY);
		airQualityProvider = unitRef.get<AirQualityProvider>(AIR_QUALITY_PROVIDER);
		lifestyleIndexProvider = unitRef.get<LifestyleIndexProvider>(LIFESTYLE_INDEX_PROVIDER);
		sunTimeProvider = unitRef.get<SunTimeProvider>(SUN_TIME_PROVIDER);
		forecastReader = unitRef.get(WeatherForecastReader);
		cache = unitRef.get<WeatherCachePort>(WEATHER_CACHE);

		repository.findByUserId.mockResolvedValue(location);
	});

	it("위치가 없으면 WEATHER_1902를 던지고 캐시·프로바이더에 접근하지 않는다", async () => {
		// Given
		repository.findByUserId.mockResolvedValue(null);

		// When & Then
		await expect(useCase.execute(input)).rejects.toMatchObject({
			errorCode: ErrorCode.WEATHER_1902,
		});
		expect(cache.getConditions).not.toHaveBeenCalled();
		expect(airQualityProvider.getAirQuality).not.toHaveBeenCalled();
	});

	it("conditions 캐시 히트 시 프로바이더를 호출하지 않고 캐시 값을 반환한다", async () => {
		// Given
		const cached = {
			feelsLikeTemperature: 27,
			uvIndex: 5,
			sunrise: "05:30",
			sunset: "19:45",
			pm10: 30,
			pm25: 15,
		};
		cache.getConditions.mockResolvedValue(cached);

		// When
		const result = await useCase.execute(input);

		// Then - 격자 기준 캐시 조회, 프로바이더/저장은 미수행
		expect(cache.getConditions).toHaveBeenCalledWith(60, 127);
		expect(forecastReader.fetchForLocation).not.toHaveBeenCalled();
		expect(airQualityProvider.getAirQuality).not.toHaveBeenCalled();
		expect(lifestyleIndexProvider.getIndex).not.toHaveBeenCalled();
		expect(sunTimeProvider.getSunTime).not.toHaveBeenCalled();
		expect(cache.setConditions).not.toHaveBeenCalled();
		expect(result).toBe(cached);
	});

	it("캐시 미스 시 3개 프로바이더 결과를 병합하고 격자 캐시에 저장한다", async () => {
		// Given
		cache.getConditions.mockResolvedValue(undefined);
		forecastReader.fetchForLocation.mockResolvedValue(buildForecast());
		airQualityProvider.getAirQuality.mockResolvedValue({ pm10: 30, pm25: 15 });
		lifestyleIndexProvider.getIndex.mockResolvedValue({
			feelsLikeTemperature: 27,
			uvIndex: 5,
		});
		sunTimeProvider.getSunTime.mockResolvedValue({
			sunrise: "05:30",
			sunset: "19:45",
		});

		// When
		const result = await useCase.execute(input);

		// Then - 좌표는 프로바이더에, 병합 결과는 격자 캐시에
		expect(airQualityProvider.getAirQuality).toHaveBeenCalledWith(37.5665, 126.978);
		const conditions = {
			feelsLikeTemperature: 27,
			uvIndex: 5,
			sunrise: "05:30",
			sunset: "19:45",
			pm10: 30,
			pm25: 15,
		};
		expect(result).toEqual(conditions);
		expect(cache.setConditions).toHaveBeenCalledWith(60, 127, conditions);
	});

	it("lifestyle 계산에는 예보의 현재 기온/풍속을 전달한다 (시간 미스 시 최고기온 폴백)", async () => {
		// Given - hourlyForecasts 비어 현재 시각 매치 실패 → temperatureMax 사용
		cache.getConditions.mockResolvedValue(undefined);
		forecastReader.fetchForLocation.mockResolvedValue(buildForecast());
		airQualityProvider.getAirQuality.mockResolvedValue({ pm10: 10, pm25: 5 });
		lifestyleIndexProvider.getIndex.mockResolvedValue({
			feelsLikeTemperature: 30,
			uvIndex: 7,
		});
		sunTimeProvider.getSunTime.mockResolvedValue({
			sunrise: "05:30",
			sunset: "19:45",
		});

		// When
		await useCase.execute(input);

		// Then - currentTemp=temperatureMax(28), windSpeed=4
		expect(lifestyleIndexProvider.getIndex).toHaveBeenCalledWith(37.5665, 126.978, date, 28, 4);
	});

	it("일부 프로바이더 실패 시 해당 필드만 null로 강등한다 (graceful degradation)", async () => {
		// Given - air/sun 실패, lifestyle만 성공
		cache.getConditions.mockResolvedValue(undefined);
		forecastReader.fetchForLocation.mockResolvedValue(buildForecast());
		airQualityProvider.getAirQuality.mockRejectedValue(new Error("air down"));
		lifestyleIndexProvider.getIndex.mockResolvedValue({
			feelsLikeTemperature: 27,
			uvIndex: null,
		});
		sunTimeProvider.getSunTime.mockRejectedValue(new Error("sun down"));

		// When
		const result = await useCase.execute(input);

		// Then - 실패 프로바이더 필드는 null, 성공 필드는 보존
		expect(result).toEqual({
			feelsLikeTemperature: 27,
			uvIndex: null,
			sunrise: null,
			sunset: null,
			pm10: null,
			pm25: null,
		});
		// 부분 실패여도 결과는 캐시된다
		expect(cache.setConditions).toHaveBeenCalledTimes(1);
	});

	it("모든 프로바이더 실패 시 전 필드 null을 반환한다", async () => {
		// Given
		cache.getConditions.mockResolvedValue(undefined);
		forecastReader.fetchForLocation.mockResolvedValue(buildForecast());
		airQualityProvider.getAirQuality.mockRejectedValue(new Error("x"));
		lifestyleIndexProvider.getIndex.mockRejectedValue(new Error("x"));
		sunTimeProvider.getSunTime.mockRejectedValue(new Error("x"));

		// When
		const result = await useCase.execute(input);

		// Then
		expect(result).toEqual({
			feelsLikeTemperature: null,
			uvIndex: null,
			sunrise: null,
			sunset: null,
			pm10: null,
			pm25: null,
		});
	});

	it("예보 조회가 실패하면 lifestyle 입력을 기본값(0,0)으로 폴백한다", async () => {
		// Given - 예보 리더 실패 → currentTempAndWind catch → {0,0}
		cache.getConditions.mockResolvedValue(undefined);
		forecastReader.fetchForLocation.mockRejectedValue(new Error("kma down"));
		airQualityProvider.getAirQuality.mockResolvedValue({ pm10: 10, pm25: 5 });
		lifestyleIndexProvider.getIndex.mockResolvedValue({
			feelsLikeTemperature: 25,
			uvIndex: 3,
		});
		sunTimeProvider.getSunTime.mockResolvedValue({
			sunrise: "05:30",
			sunset: "19:45",
		});

		// When
		await useCase.execute(input);

		// Then - currentTemp=0, windSpeed=0으로 lifestyle 계산 진입
		expect(lifestyleIndexProvider.getIndex).toHaveBeenCalledWith(37.5665, 126.978, date, 0, 0);
	});
});
