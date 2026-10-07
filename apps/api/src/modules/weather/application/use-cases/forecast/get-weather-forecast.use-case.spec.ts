import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createWeatherLocationRepositoryMock } from "#test/mocks/ports/weather.mock";

import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { type WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";
import type { WeatherForecast } from "../../ports/forecast/weather-provider.port.js";
import { WeatherForecastReader } from "../../services/forecast/weather-forecast.reader.js";
import { GetWeatherForecast } from "./get-weather-forecast.use-case.js";

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

describe("GetWeatherForecast — 사용자 위치 기반 예보 조회", () => {
  let useCase: GetWeatherForecast;
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
    const getWeatherForecastDependencies = mockDeep<
      ConstructorParameters<typeof GetWeatherForecast>[0]
    >({ repository: createWeatherLocationRepositoryMock() });
    const unit = new GetWeatherForecast(getWeatherForecastDependencies);

    useCase = unit;
    repository = getWeatherForecastDependencies.repository;
    forecastReader = getWeatherForecastDependencies.forecastReader;
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
    expect(forecastReader.fetchForLocation).toHaveBeenCalledWith(location, date);
    expect(result).toEqual({ forecast, location });
  });

  it("위치가 없으면 WEATHER_1902를 던지고 예보 리더로 진입하지 않는다", async () => {
    // Given
    repository.findByUserId.mockResolvedValue(null);

    // When & Then
    await expect(useCase.execute({ userId: "user-123", date })).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1902,
    });
    expect(forecastReader.fetchForLocation).not.toHaveBeenCalled();
  });
});
