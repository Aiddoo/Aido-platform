/**
 * GetWeatherForecastUseCase 단위 테스트
 *
 * - 사용자 위치 조회 → 예보 리더(캐시-스루)에 위임 → 예보+위치를 함께 반환
 * - 위치 미등록 시 WEATHER_1902 (예보 조회로 진입하지 않음)
 * - 캐시/프로바이더/폴백 오케스트레이션은 WeatherForecastReader 소유이므로 여기서는 위임만 검증
 */
import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createWeatherLocationRepositoryMock } from "@test/mocks/ports/weather.mock";
import { UserLocation } from "../../../domain/entities/user-location.entity";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import type { WeatherForecast } from "../../ports/weather-provider.port";
import { WeatherForecastReader } from "../../services/weather-forecast.reader";
import { GetWeatherForecastUseCase } from "./get-weather-forecast.use-case";

function buildForecast(): WeatherForecast {
	return {
		date: new Date("2026-07-23T00:00:00.000Z"),
		skyCondition: "CLEAR",
		precipitationType: "NONE",
		precipitationProbability: 0,
		temperatureMin: 20,
		temperatureMax: 28,
		humidity: 55,
		windSpeed: 3,
		hourlyForecasts: [],
		dailyForecasts: [],
	};
}

describe("GetWeatherForecastUseCase — 사용자 위치 기반 예보 조회", () => {
	let useCase: GetWeatherForecastUseCase;
	let repository: Mocked<WeatherLocationRepositoryPort>;
	let forecastReader: Mocked<WeatherForecastReader>;

	const date = new Date("2026-07-23T09:00:00.000Z");
	const location = UserLocation.reconstitute({
		userId: "user-123",
		latitude: 37.5665,
		longitude: 126.978,
		gridX: 60,
		gridY: 127,
	});

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetWeatherForecastUseCase)
			.mock<WeatherLocationRepositoryPort>(WEATHER_LOCATION_REPOSITORY)
			.impl(() => createWeatherLocationRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<WeatherLocationRepositoryPort>(
			WEATHER_LOCATION_REPOSITORY,
		);
		forecastReader = unitRef.get(WeatherForecastReader);
	});

	it("위치를 조회해 예보 리더에 위임하고 예보+위치를 함께 반환한다", async () => {
		// Given
		const forecast = buildForecast();
		repository.findByUserId.mockResolvedValue(location);
		forecastReader.fetchForLocation.mockResolvedValue(forecast);

		// When
		const result = await useCase.execute({ userId: "user-123", date });

		// Then - 컨트롤러가 좌표를 병합할 수 있도록 location도 함께 반환
		expect(repository.findByUserId).toHaveBeenCalledWith("user-123");
		expect(forecastReader.fetchForLocation).toHaveBeenCalledWith(
			location,
			date,
		);
		expect(result).toEqual({ forecast, location });
	});

	it("위치가 없으면 WEATHER_1902를 던지고 예보 리더로 진입하지 않는다", async () => {
		// Given
		repository.findByUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ userId: "user-123", date }),
		).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1902 });
		expect(forecastReader.fetchForLocation).not.toHaveBeenCalled();
	});
});
