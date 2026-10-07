import { ErrorCode } from "@aido/api/errors";
import { mock } from "vitest-mock-extended";

import { WeatherForecastReader } from "#api/modules/weather/application/services/forecast/weather-forecast.reader";
import { WeatherCacheAdapter } from "#api/modules/weather/infrastructure/adapters/forecast/weather-cache.adapter";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { weatherConditionsFixture, weatherLocationFixture } from "#test/fixtures/weather.fixture";
import {
  StubAirQualityProvider,
  StubLifestyleIndexProvider,
  StubSunTimeProvider,
  StubWeatherLocationRepository,
  StubWeatherProvider,
} from "#test/mocks/ports/weather.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GetWeatherConditions } from "./get-weather-conditions.use-case.js";

describe("GetWeatherConditions — 날짜별 부가정보와 부분 실패", () => {
  let memory: InMemoryCacheAdapter;
  let cache: WeatherCacheAdapter;
  let repository: StubWeatherLocationRepository;
  let weatherProvider: StubWeatherProvider;
  let airQualityProvider: StubAirQualityProvider;
  let lifestyleIndexProvider: StubLifestyleIndexProvider;
  let sunTimeProvider: StubSunTimeProvider;
  let conditions: GetWeatherConditions;
  const date = new Date("2026-07-23T00:00:00.000Z");

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherCacheAdapter(new CacheService(memory));
    repository = new StubWeatherLocationRepository([weatherLocationFixture()]);
    weatherProvider = new StubWeatherProvider();
    airQualityProvider = new StubAirQualityProvider();
    lifestyleIndexProvider = new StubLifestyleIndexProvider();
    sunTimeProvider = new StubSunTimeProvider();
    const logger = mock<ApplicationLogger>();
    const forecastReader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger,
    });
    conditions = new GetWeatherConditions({
      weatherLocationRepository: repository,
      weatherProvider,
      airQualityProvider,
      lifestyleIndexProvider,
      sunTimeProvider,
      forecastReader,
      weatherCache: cache,
      logger,
    });
  });

  afterEach(() => {
    try {
      memory.onModuleDestroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("위치가 없으면 WEATHER_1902이며 공급자에 접근하지 않는다", async () => {
    // Given
    repository.records.clear();
    // When & Then
    await expect(conditions.execute({ userId: "weather-user", date })).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1902,
    });
    expect(weatherProvider.calls).toEqual([]);
    expect(sunTimeProvider.calls).toEqual([]);
  });

  it("같은 날짜 캐시가 있으면 공급자 장애에도 저장된 결과를 반환한다", async () => {
    // Given
    const saved = weatherConditionsFixture();
    await cache.setConditions(60, 127, date, saved);
    weatherProvider.failure = new Error("forecast down");
    sunTimeProvider.failure = new Error("sun down");
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(result).toEqual(saved);
    expect(weatherProvider.calls).toEqual([]);
    expect(airQualityProvider.calls).toEqual([]);
    expect(lifestyleIndexProvider.calls).toEqual([]);
    expect(sunTimeProvider.calls).toEqual([]);
  });

  it("같은 격자라도 날짜가 다르면 해당 날짜 일출입을 읽고 재조회는 캐시한다", async () => {
    // Given
    const tomorrow = new Date("2026-07-24T00:00:00.000Z");
    sunTimeProvider.dates.set("2026-07-23", { sunrise: "05:23", sunset: "19:00" });
    sunTimeProvider.dates.set("2026-07-24", { sunrise: "05:24", sunset: "19:01" });
    // When
    const today = await conditions.execute({ userId: "weather-user", date });
    const next = await conditions.execute({ userId: "weather-user", date: tomorrow });
    const again = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(today.sunrise).toBe("05:23");
    expect(next.sunrise).toBe("05:24");
    expect(next.sunset).toBe("19:01");
    expect(again).toEqual(today);
    expect(sunTimeProvider.calls.map((call) => call.date.toISOString())).toEqual([
      date.toISOString(),
      tomorrow.toISOString(),
    ]);
  });

  it("동일 instant의 한국 예보 09시 기온을 체감 계산에 전달한다", async () => {
    // Given - UTC 00시=1, 한국 09시=25, LA 17시=15인 고정 예보
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(result.feelsLikeTemperature).toBe(25);
    expect(
      lifestyleIndexProvider.calls.map(({ currentTemp, windSpeed }) => ({
        currentTemp,
        windSpeed,
      })),
    ).toEqual([{ currentTemp: 25, windSpeed: 4 }]);
  });

  it.each([
    ["UTC", 1],
    ["America/Los_Angeles", 15],
  ])("공급자 시간대 %s의 hour를 선택한다", async (timeZone, expectedTemperature) => {
    // Given - 공급자 metadata는 서버 host TZ와 독립이다.
    const provider = new StubWeatherProvider(String(timeZone));
    const logger = mock<ApplicationLogger>();
    const forecastReader = new WeatherForecastReader({
      weatherProvider: provider,
      weatherCache: cache,
      logger,
    });
    const localConditions = new GetWeatherConditions({
      weatherLocationRepository: repository,
      weatherProvider: provider,
      airQualityProvider,
      lifestyleIndexProvider,
      sunTimeProvider,
      forecastReader,
      weatherCache: cache,
      logger,
    });
    // When
    const result = await localConditions.execute({ userId: "weather-user", date });
    // Then
    expect(result.feelsLikeTemperature).toBe(expectedTemperature);
  });

  it("해당 시간 예보가 없으면 최고기온을 체감 계산에 사용한다", async () => {
    // Given
    weatherProvider.forecast = { ...weatherProvider.forecast, hourlyForecasts: [] };
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(result.feelsLikeTemperature).toBe(30);
    expect(lifestyleIndexProvider.calls[0]?.currentTemp).toBe(30);
  });

  it("일부 공급자 실패는 해당 필드만 null로 만들고 유효한 0과 일출입을 보존한다", async () => {
    // Given
    airQualityProvider.failure = new Error("air down");
    lifestyleIndexProvider.result = { feelsLikeTemperature: 0, uvIndex: 0 };
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    const cached = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(result).toEqual(
      weatherConditionsFixture({ feelsLikeTemperature: 0, pm10: null, pm25: null }),
    );
    expect(cached).toEqual(result);
    expect(airQualityProvider.calls).toHaveLength(1);
    expect(sunTimeProvider.calls).toHaveLength(1);
  });

  it("모든 부가정보 공급자가 실패하면 여섯 필드를 null로 반환한다", async () => {
    // Given
    airQualityProvider.failure = new Error("air down");
    lifestyleIndexProvider.failure = new Error("lifestyle down");
    sunTimeProvider.failure = new Error("sun down");
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(result).toEqual(
      weatherConditionsFixture({
        feelsLikeTemperature: null,
        uvIndex: null,
        sunrise: null,
        sunset: null,
        pm10: null,
        pm25: null,
      }),
    );
  });

  it("예보와 latest가 없어도 체감 계산은 0/0으로 계속하고 다른 공급자 값은 보존한다", async () => {
    // Given
    weatherProvider.failure = new Error("forecast down");
    // When
    const result = await conditions.execute({ userId: "weather-user", date });
    // Then
    expect(lifestyleIndexProvider.calls[0]).toMatchObject({ currentTemp: 0, windSpeed: 0 });
    expect(result).toEqual(weatherConditionsFixture({ feelsLikeTemperature: 0 }));
  });
});
