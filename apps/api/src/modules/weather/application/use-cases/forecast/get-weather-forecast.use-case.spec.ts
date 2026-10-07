import { ErrorCode } from "@aido/api/errors";
import { mock } from "vitest-mock-extended";

import { WeatherForecastReader } from "#api/modules/weather/application/services/forecast/weather-forecast.reader";
import { WeatherCacheAdapter } from "#api/modules/weather/infrastructure/adapters/forecast/weather-cache.adapter";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { weatherLocationFixture } from "#test/fixtures/weather.fixture";
import { StubWeatherLocationRepository, StubWeatherProvider } from "#test/mocks/ports/weather.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GetWeatherForecast } from "./get-weather-forecast.use-case.js";

describe("GetWeatherForecast — 사용자 위치와 예보", () => {
  let memory: InMemoryCacheAdapter;
  let repository: StubWeatherLocationRepository;
  let weatherProvider: StubWeatherProvider;
  let useCase: GetWeatherForecast;
  const date = new Date("2026-07-23T00:00:00.000Z");

  beforeEach(() => {
    suppressLogger();
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    repository = new StubWeatherLocationRepository([weatherLocationFixture()]);
    weatherProvider = new StubWeatherProvider();
    const cache = new WeatherCacheAdapter(new CacheService(memory));
    const forecastReader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger: mock<ApplicationLogger>(),
    });
    useCase = new GetWeatherForecast({ weatherLocationRepository: repository, forecastReader });
  });
  afterEach(() => memory.onModuleDestroy());

  it("사용자의 저장 좌표와 예보 결과를 함께 반환한다", async () => {
    // Given
    // When
    const result = await useCase.execute({ userId: "weather-user", date });
    // Then
    expect(result.location.latitude).toBe(37.5665);
    expect(result.location.longitude).toBe(126.978);
    expect(result.forecast.temperatureMax).toBe(30);
    expect(result.forecast.hourlyForecasts.find((hour) => hour.hour === 9)?.temperature).toBe(25);
  });

  it("위치가 없으면 WEATHER_1902이며 예보를 요청하지 않는다", async () => {
    // Given
    repository.records.clear();
    // When & Then
    await expect(useCase.execute({ userId: "weather-user", date })).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1902,
    });
    expect(weatherProvider.calls).toEqual([]);
  });
});
