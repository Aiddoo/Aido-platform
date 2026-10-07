import { WeatherCacheAdapter } from "#api/modules/weather/infrastructure/adapters/forecast/weather-cache.adapter";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import {
  weatherConditionsFixture,
  weatherForecastFixture,
  weatherLocationFixture,
} from "#test/fixtures/weather.fixture";
import {
  StubWeatherGridResolver,
  StubWeatherLocationRepository,
} from "#test/mocks/ports/weather.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import { UpsertLocation } from "./upsert-location.use-case.js";

describe("UpsertLocation — 위치 저장과 이전 격자 무효화", () => {
  let memory: InMemoryCacheAdapter;
  let cache: WeatherCacheAdapter;
  let repository: StubWeatherLocationRepository;
  let resolver: StubWeatherGridResolver;
  let useCase: UpsertLocation;
  const date = new Date("2026-07-23T00:00:00.000Z");
  const next = new Date("2026-07-24T00:00:00.000Z");

  beforeEach(() => {
    suppressLogger();
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherCacheAdapter(new CacheService(memory));
    repository = new StubWeatherLocationRepository();
    resolver = new StubWeatherGridResolver();
    useCase = new UpsertLocation({
      weatherLocationRepository: repository,
      weatherCache: cache,
      weatherGridResolver: resolver,
    });
  });
  afterEach(() => memory.onModuleDestroy());

  it("최초 위치를 해결한 격자와 함께 저장하고 같은 격자의 캐시는 보존한다", async () => {
    // Given
    const cached = weatherConditionsFixture();
    await cache.setConditions(60, 127, date, cached);
    // When
    const result = await useCase.execute({
      userId: "weather-user",
      latitude: 37.5665,
      longitude: 126.978,
    });
    // Then
    expect(result.gridX).toBe(60);
    expect(result.gridY).toBe(127);
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
      await cache.saveForecast(60, 127, day, weatherForecastFixture({ date: day }));
    }
    await cache.setConditions(98, 76, date, weatherConditionsFixture({ sunrise: "05:30" }));
    // When
    const result = await useCase.execute({
      userId: "weather-user",
      latitude: 35.1796,
      longitude: 129.0756,
    });
    // Then
    expect(result.latitude).toBe(35.1796);
    expect(result.gridX).toBe(98);
    for (const day of [date, next]) {
      expect(await cache.getConditions(60, 127, day)).toBeUndefined();
      expect(await cache.getForecast(60, 127, day)).toBeUndefined();
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
});
