import { ErrorCode } from "@aido/api/errors";
import { mock } from "vitest-mock-extended";

import { WeatherCacheAdapter } from "#api/modules/weather/infrastructure/adapters/forecast/weather-cache.adapter";
import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { weatherForecastFixture, weatherLocationFixture } from "#test/fixtures/weather.fixture";
import { StubWeatherProvider } from "#test/mocks/ports/weather.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import { WeatherForecastReader } from "./weather-forecast.reader.js";

describe("WeatherForecastReader — cache·latest fallback·격자 batch", () => {
  let memory: InMemoryCacheAdapter;
  let cache: WeatherCacheAdapter;
  let weatherProvider: StubWeatherProvider;
  let reader: WeatherForecastReader;
  const date = new Date("2026-07-23T00:00:00.000Z");

  beforeEach(() => {
    suppressLogger();
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherCacheAdapter(new CacheService(memory));
    weatherProvider = new StubWeatherProvider();
    reader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger: mock<ApplicationLogger>(),
    });
  });
  afterEach(() => memory.onModuleDestroy());

  it("현재 발표 cache가 있으면 공급자에 접근하지 않고 값을 반환한다", async () => {
    // Given
    const cached = weatherForecastFixture({ temperatureMax: 17 });
    await cache.saveForecast(60, 127, date, cached);
    // When
    const result = await reader.fetchForLocation(weatherLocationFixture(), date);
    // Then
    expect(result).toEqual(cached);
    expect(weatherProvider.calls).toEqual([]);
  });

  it("공급자 성공 결과를 정규·latest cache에 저장하고 재조회는 cache를 쓴다", async () => {
    // Given
    // When
    const first = await reader.fetchForLocation(weatherLocationFixture(), date);
    const second = await reader.fetchForLocation(weatherLocationFixture(), date);
    // Then
    expect(second).toEqual(first);
    expect(await cache.getForecast(60, 127, date)).toEqual(first);
    expect(await cache.getLatestForecast(60, 127)).toEqual(first);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("공급자 실패 시 이전 발표 latest를 반환한다", async () => {
    // Given
    const previous = new Date("2026-07-22T00:00:00.000Z");
    const saved = weatherForecastFixture({ date: previous, temperatureMax: 18 });
    await cache.saveForecast(60, 127, previous, saved);
    weatherProvider.failure = new Error("provider down");
    // When
    const result = await reader.fetchForLocation(weatherLocationFixture(), date);
    // Then
    expect(result).toEqual(saved);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("공급자 실패와 latest 없음이 겹치면 WEATHER_1901을 반환한다", async () => {
    // Given
    weatherProvider.failure = new Error("provider down");
    // When & Then
    await expect(reader.fetchForLocation(weatherLocationFixture(), date)).rejects.toMatchObject({
      errorCode: ErrorCode.WEATHER_1901,
    });
  });

  it("batch는 hit을 재조회하지 않고 miss의 성공·latest·누락을 격자별로 반환한다", async () => {
    // Given
    const grids = [
      { gridX: 60, gridY: 127, lat: 37.5665, lon: 126.978 },
      { gridX: 98, gridY: 76, lat: 35.1796, lon: 129.0756 },
      { gridX: 52, gridY: 38, lat: 33.4996, lon: 126.5312 },
      { gridX: 89, gridY: 90, lat: 35.8, lon: 128.6 },
    ];
    const hit = weatherForecastFixture({ temperatureMax: 11 });
    const fresh = weatherForecastFixture({ temperatureMax: 22 });
    const latest = weatherForecastFixture({
      date: new Date("2026-07-22T00:00:00.000Z"),
      temperatureMax: 33,
    });
    await cache.saveForecast(60, 127, date, hit);
    await cache.saveForecast(52, 38, latest.date, latest);
    weatherProvider.results.set("35.1796:129.0756", fresh);
    weatherProvider.results.set("33.4996:126.5312", new Error("jeju down"));
    weatherProvider.results.set("35.8:128.6", new Error("no fallback"));
    // When
    const result = await reader.getForecastsByGridBatch(grids, date);
    // Then
    expect(result.size).toBe(3);
    expect(result.get("60:127")?.temperatureMax).toBe(11);
    expect(result.get("98:76")?.temperatureMax).toBe(22);
    expect(result.get("52:38")?.temperatureMax).toBe(33);
    expect(result.has("89:90")).toBe(false);
    expect(weatherProvider.calls.map(({ lat, lon }) => ({ lat, lon }))).toEqual(
      grids.slice(1).map(({ lat, lon }) => ({ lat, lon })),
    );
    expect(await cache.getForecast(98, 76, date)).toEqual(fresh);
    expect(await cache.getForecast(52, 38, date)).toBeUndefined();
    expect(await cache.getForecast(89, 90, date)).toBeUndefined();
  });

  it("빈 batch는 빈 Map을 반환하고 공급자에 접근하지 않는다", async () => {
    // Given
    // When
    const result = await reader.getForecastsByGridBatch([], date);
    // Then
    expect(result.size).toBe(0);
    expect(weatherProvider.calls).toEqual([]);
  });
});
