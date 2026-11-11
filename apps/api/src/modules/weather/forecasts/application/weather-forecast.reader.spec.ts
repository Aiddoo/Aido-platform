import { ErrorCode } from "@aido/api/errors";

import type { KmaForecastTiming } from "#api/modules/weather/forecasts/domain/kma-forecast-availability.domain-service";
import { WeatherForecastCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubWeatherForecastProvider } from "#test/doubles/weather/stub-weather-forecast-provider";
import { kmaTimingFixture, weatherForecastFixture } from "#test/fixtures/weather.fixture";
import { weatherLocationFixture } from "#test/fixtures/weather/user-location.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { WeatherForecastReader } from "./weather-forecast.reader.js";

describe("WeatherForecastReader — cache·latest fallback·격자 batch", () => {
  let memory: InMemoryCacheStore;
  let cache: WeatherForecastCache;
  let weatherProvider: StubWeatherForecastProvider;
  let reader: WeatherForecastReader;
  const date = new Date("2026-07-23T00:00:00.000Z");

  beforeEach(() => {
    // 예보 제공 범위가 현재 시각 기준이므로 요청 날짜의 KST 09:00을 지금으로 고정한다.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date);
    suppressLogger();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherForecastCache(memory);
    weatherProvider = new StubWeatherForecastProvider();
    reader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger: new SilentLogger(),
      clock: new FakeTimerClock(),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("현재 발표 cache가 있으면 공급자에 접근하지 않고 값을 반환한다", async () => {
    // Given
    const cached = weatherForecastFixture({ temperatureMax: 17 });
    await cache.saveForecastBatch(
      [{ gridX: 60, gridY: 127, forecast: cached }],
      kmaTimingFixture(date),
    );
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
    expect(await cache.getForecast(60, 127, kmaTimingFixture(date))).toEqual(first);
    expect(await cache.getLatestForecast(60, 127)).toEqual(first);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("공급자 실패 시 이전 발표 latest를 반환한다", async () => {
    // Given
    const previous = new Date("2026-07-22T00:00:00.000Z");
    const saved = weatherForecastFixture({ date: previous, temperatureMax: 18 });
    await cache.saveForecastBatch(
      [{ gridX: 60, gridY: 127, forecast: saved }],
      kmaTimingFixture(previous),
    );
    weatherProvider.failure = new Error("provider down");
    // When
    const result = await reader.fetchForLocation(weatherLocationFixture(), date);
    // Then
    expect(result).toEqual(saved);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("같은 격자를 동시에 물으면 공급자를 한 번만 부르고 같은 예보를 나눠 쓴다", async () => {
    // Given
    const location = weatherLocationFixture();
    // When
    const results = await Promise.all([
      reader.fetchForLocation(location, date),
      reader.fetchForLocation(location, date),
      reader.fetchForLocation(location, date),
    ]);
    // Then
    expect(weatherProvider.calls).toHaveLength(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it("실패한 격자는 1분 동안 공급자를 부르지 않고 latest로 넘어가고 1분 뒤 다시 부른다", async () => {
    // Given
    const previous = new Date("2026-07-22T00:00:00.000Z");
    const saved = weatherForecastFixture({ date: previous, temperatureMax: 18 });
    await cache.saveForecastBatch(
      [{ gridX: 60, gridY: 127, forecast: saved }],
      kmaTimingFixture(previous),
    );
    weatherProvider.failure = new Error("provider down");
    await reader.fetchForLocation(weatherLocationFixture(), date);
    // When
    const duringCooldown = await reader.fetchForLocation(weatherLocationFixture(), date);
    const callsDuringCooldown = weatherProvider.calls.length;
    vi.setSystemTime(date.getTime() + 61_000);
    weatherProvider.failure = null;
    const recovered = await reader.fetchForLocation(weatherLocationFixture(), date);
    // Then
    expect(duringCooldown).toEqual(saved);
    expect(callsDuringCooldown).toBe(1);
    expect(weatherProvider.calls).toHaveLength(2);
    expect(recovered.temperatureMax).not.toBe(18);
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
    await cache.saveForecastBatch(
      [{ gridX: 60, gridY: 127, forecast: hit }],
      kmaTimingFixture(date),
    );
    await cache.saveForecastBatch(
      [{ gridX: 52, gridY: 38, forecast: latest }],
      kmaTimingFixture(latest.date),
    );
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
    expect(await cache.getForecast(98, 76, kmaTimingFixture(date))).toEqual(fresh);
    expect(await cache.getForecast(52, 38, kmaTimingFixture(date))).toBeUndefined();
    expect(await cache.getForecast(89, 90, kmaTimingFixture(date))).toBeUndefined();
  });

  it("batch miss는 공급자를 최대 4개씩 동시에 호출하고 모든 격자의 결과를 저장한다", async () => {
    // Given
    const tracking = new ConcurrencyTrackingWeatherProvider();
    reader = new WeatherForecastReader({
      weatherProvider: tracking,
      weatherCache: cache,
      logger: new SilentLogger(),
      clock: new FakeTimerClock(),
    });
    const grids = Array.from({ length: 10 }, (_, i) => ({
      gridX: 50 + i,
      gridY: 100,
      lat: 37 + i / 100,
      lon: 127,
    }));
    tracking.results.set("37.05:127", new Error("transient"));
    // When
    const result = await reader.getForecastsByGridBatch(grids, date);
    // Then
    expect(tracking.maxActive).toBe(4);
    expect(tracking.calls.map(({ lat }) => lat)).toEqual(grids.map(({ lat }) => lat));
    expect(result.size).toBe(9);
    expect(result.has("55:100")).toBe(false);
    expect(await cache.getForecast(59, 100, kmaTimingFixture(date))).toEqual(result.get("59:100"));
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

class ConcurrencyTrackingWeatherProvider extends StubWeatherForecastProvider {
  active = 0;
  maxActive = 0;

  override async getForecast(lat: number, lon: number, timing: KmaForecastTiming) {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await Promise.resolve();
      return await super.getForecast(lat, lon, timing);
    } finally {
      this.active -= 1;
    }
  }
}

describe("WeatherForecastReader — KMA 제공 범위 (#1156)", () => {
  let memory: InMemoryCacheStore;
  let cache: WeatherForecastCache;
  let weatherProvider: StubWeatherForecastProvider;
  let reader: WeatherForecastReader;
  /** 운영에서 503이 난 시각: KST 2026-11-02 04:18 */
  const now = new Date("2026-11-01T19:18:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    suppressLogger();
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherForecastCache(memory);
    weatherProvider = new StubWeatherForecastProvider();
    reader = new WeatherForecastReader({
      weatherProvider,
      weatherCache: cache,
      logger: new SilentLogger(),
      clock: new FakeTimerClock(),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("아침 발표 전 오늘 날짜 요청은 지금의 발표로 조회해 정상 예보를 준다", async () => {
    // Given
    const today = new Date("2026-11-02T00:00:00.000Z");
    // When
    const forecast = await reader.fetchForLocation(weatherLocationFixture(), today);
    // Then
    expect(forecast.date).toEqual(today);
    expect(weatherProvider.calls).toEqual([
      { lat: 37.5665, lon: 126.978, date: today, issuance: now },
    ]);
  });

  it.each([
    ["3일보다 오래된 날짜", "2026-10-30"],
    ["모레보다 먼 날짜", "2026-11-05"],
  ])("%s는 KMA를 부르지 않고 400 SYS_0002다", async (_case, day) => {
    // Given
    const requested = new Date(`${day}T00:00:00.000Z`);
    // When
    const result = reader.fetchForLocation(weatherLocationFixture(), requested);
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(weatherProvider.calls).toEqual([]);
  });

  it("배치 조회의 날짜가 범위 밖이면 KMA를 부르지 않고 빈 결과를 준다", async () => {
    // Given
    const grids = [{ gridX: 60, gridY: 127, lat: 37.5665, lon: 126.978 }];
    // When
    const result = await reader.getForecastsByGridBatch(grids, new Date("2026-11-06T00:00:00Z"));
    // Then
    expect(result.size).toBe(0);
    expect(weatherProvider.calls).toEqual([]);
  });

  it("같은 발표를 쓰더라도 대상 날짜가 다르면 캐시를 나눈다", async () => {
    // Given
    const today = new Date("2026-11-02T00:00:00.000Z");
    const tomorrow = new Date("2026-11-03T00:00:00.000Z");
    // When
    await reader.fetchForLocation(weatherLocationFixture(), today);
    await reader.fetchForLocation(weatherLocationFixture(), tomorrow);
    // Then
    expect(weatherProvider.calls.map((call) => call.date)).toEqual([today, tomorrow]);
    expect(weatherProvider.calls.map((call) => call.issuance)).toEqual([now, now]);
  });
});
