import { WeatherForecastCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { Coordinate } from "#api/modules/weather/shared/domain/coordinate.vo";
import { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import { kmaTimingFixture } from "#test/fixtures/weather.fixture";
import {
  weatherConditionsFixture,
  weatherForecastFixture,
  weatherLocationFixture,
} from "#test/fixtures/weather.fixture";
import {
  StubTimezoneResolver,
  StubWeatherGridResolver,
  StubWeatherLocationRepository,
} from "#test/mocks/ports/weather.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import { UpsertUserLocationUseCase } from "./upsert-user-location.use-case.js";

describe("UpsertUserLocationUseCase — 위치 저장과 이전 격자 무효화", () => {
  let memory: InMemoryCacheStore;
  let cache: WeatherForecastCache;
  let repository: StubWeatherLocationRepository;
  let resolver: StubWeatherGridResolver;
  let timezoneResolver: StubTimezoneResolver;
  let useCase: UpsertUserLocationUseCase;
  const date = new Date("2026-07-23T00:00:00.000Z");
  const next = new Date("2026-07-24T00:00:00.000Z");

  beforeEach(() => {
    suppressLogger();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherForecastCache(new CacheService(memory));
    repository = new StubWeatherLocationRepository();
    resolver = new StubWeatherGridResolver();
    timezoneResolver = new StubTimezoneResolver();
    useCase = new UpsertUserLocationUseCase({
      weatherLocationRepository: repository,
      weatherCache: cache,
      weatherGridResolver: resolver,
      timezoneResolver,
    });
  });

  it("최초 위치를 해결한 격자와 함께 저장하고 같은 격자의 캐시는 보존한다", async () => {
    // Given
    const cached = weatherConditionsFixture();
    await cache.setConditions(60, 127, date, cached);
    // When
    const { location: result, timezone } = await useCase.execute({
      userId: "weather-user",
      latitude: 37.5665,
      longitude: 126.978,
    });
    // Then
    expect(result.grid?.gridX).toBe(60);
    expect(result.grid?.gridY).toBe(127);
    expect(result.timezone).toBe("Asia/Seoul");
    expect(timezone).toBe("Asia/Seoul");
    expect(repository.records.get("weather-user")).toBe(result);
    expect(await cache.getConditions(60, 127, date)).toEqual(cached);
  });

  it("격자가 같으면 저장해도 기존 캐시를 보존한다", async () => {
    // Given
    repository.records.set("weather-user", weatherLocationFixture());
    await cache.setConditions(60, 127, date, weatherConditionsFixture());
    // When
    await useCase.execute({ userId: "weather-user", latitude: 37.5665, longitude: 126.978 });
    // Then
    expect(repository.writes).toHaveLength(1);
    expect(await cache.getConditions(60, 127, date)).toEqual(weatherConditionsFixture());
  });

  it("격자를 이동하면 이전 격자의 여러 날짜 cache를 지우고 새 격자는 보존한다", async () => {
    // Given
    repository.records.set("weather-user", weatherLocationFixture());
    for (const day of [date, next]) {
      await cache.setConditions(60, 127, day, weatherConditionsFixture());
      await cache.saveForecastBatch(
        [{ gridX: 60, gridY: 127, forecast: weatherForecastFixture({ date: day }) }],
        kmaTimingFixture(day),
      );
    }
    await cache.setConditions(98, 76, date, weatherConditionsFixture({ sunrise: "05:30" }));
    // When
    const { location: result } = await useCase.execute({
      userId: "weather-user",
      latitude: 35.1796,
      longitude: 129.0756,
    });
    // Then
    expect(result.latitude).toBe(35.1796);
    expect(result.grid?.gridX).toBe(98);
    for (const day of [date, next]) {
      expect(await cache.getConditions(60, 127, day)).toBeUndefined();
      expect(await cache.getForecast(60, 127, kmaTimingFixture(day))).toBeUndefined();
    }
    expect(await cache.getLatestForecast(60, 127)).toBeUndefined();
    expect(await cache.getConditions(98, 76, date)).toEqual(
      weatherConditionsFixture({ sunrise: "05:30" }),
    );
  });

  it("저장 실패 시 이전 위치와 cache를 보존한다", async () => {
    // Given
    const original = weatherLocationFixture();
    repository.records.set("weather-user", original);
    repository.saveFailure = new Error("save failed");
    await cache.setConditions(60, 127, date, weatherConditionsFixture());
    // When & Then
    await expect(
      useCase.execute({ userId: "weather-user", latitude: 35.1796, longitude: 129.0756 }),
    ).rejects.toThrow("save failed");
    expect(repository.records.get("weather-user")).toBe(original);
    expect(await cache.getConditions(60, 127, date)).toEqual(weatherConditionsFixture());
  });

  it("격자 해결이 실패하면 위치를 읽거나 저장하지 않는다", async () => {
    // Given - 지원 공급자가 해결하지 못한 좌표
    // When & Then
    await expect(
      useCase.execute({ userId: "weather-user", latitude: 37.7, longitude: 127.5 }),
    ).rejects.toThrow("준비되지 않은 좌표의 격자입니다.");
    expect(repository.reads).toEqual([]);
    expect(repository.writes).toEqual([]);
  });

  it("해외 좌표는 격자 없이 시간대만 저장하고 KMA 격자를 계산하지 않는다", async () => {
    // Given
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    const { location, timezone } = await useCase.execute({
      userId: "weather-user",
      latitude: 35.6762,
      longitude: 139.6503,
    });
    // Then
    expect(location.grid).toBeNull();
    expect(location.timezone).toBe("Asia/Tokyo");
    expect(timezone).toBe("Asia/Tokyo");
    expect(resolver.coordinates).toEqual([]);
    expect(repository.writes).toHaveLength(1);
  });

  it("시간대는 사용자 좌표가 아니라 칸 중심 좌표로 정해 저장하고 돌려준다", async () => {
    // Given
    const coordinate = Coordinate.of(41.9, -6.56);
    timezoneResolver.region = { timezone: "Europe/Lisbon", countryCode: "PT" };
    // When
    const { location, timezone } = await useCase.execute({
      userId: "weather-user",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
    // Then
    expect(timezoneResolver.coordinates).toEqual([GeoCell.fromCoordinate(coordinate).center]);
    expect(location.timezone).toBe("Europe/Lisbon");
    expect(timezone).toBe("Europe/Lisbon");
  });

  it("한국에서 해외로 이동하면 이전 KMA 격자 캐시를 지운다", async () => {
    // Given
    repository.records.set("weather-user", weatherLocationFixture());
    await cache.setConditions(60, 127, date, weatherConditionsFixture());
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    await useCase.execute({ userId: "weather-user", latitude: 35.6762, longitude: 139.6503 });
    // Then
    expect(await cache.getConditions(60, 127, date)).toBeUndefined();
  });
});
