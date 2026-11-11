import { ErrorCode } from "@aido/api/errors";

import { WeatherForecastReader } from "#api/modules/weather/forecasts/application/weather-forecast.reader";
import { WeatherForecastCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryUserLocationRepository } from "#test/doubles/weather/in-memory-user-location.repository";
import { StubWeatherForecastProvider } from "#test/doubles/weather/stub-weather-forecast-provider";
import { weatherLocationFixture } from "#test/fixtures/weather/user-location.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GetWeatherForecastUseCase } from "./get-weather-forecast.use-case.js";

describe("GetWeatherForecastUseCase — 사용자 위치와 예보", () => {
  let memory: InMemoryCacheStore;
  let repository: InMemoryUserLocationRepository;
  let weatherProvider: StubWeatherForecastProvider;
  let useCase: GetWeatherForecastUseCase;
  const date = new Date("2026-07-23T00:00:00.000Z");

  beforeEach(() => {
    // 예보 제공 범위가 현재 시각 기준이므로 요청 날짜의 KST 09:00을 지금으로 고정한다.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);
    suppressLogger();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    repository = new InMemoryUserLocationRepository([weatherLocationFixture()]);
    weatherProvider = new StubWeatherForecastProvider();
    const cache = new WeatherForecastCache(memory);
    const forecastReader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger: new SilentLogger(),
      clock: new FakeTimerClock(),
    });
    useCase = new GetWeatherForecastUseCase({
      userLocationRepository: repository,
      forecastReader,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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
    repository.clear();
    // When & Then
    await expect(useCase.execute({ userId: "weather-user", date })).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1902,
    });
    expect(weatherProvider.calls).toEqual([]);
  });

  it("격자 없는 해외 위치는 위치 없음과 같은 WEATHER_1902이며 예보를 요청하지 않는다", async () => {
    // Given
    repository.set(weatherLocationFixture("weather-user", "도쿄"));
    // When
    const result = useCase.execute({ userId: "weather-user", date });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1902 });
    expect(weatherProvider.calls).toEqual([]);
  });
});
