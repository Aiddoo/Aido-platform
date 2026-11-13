import { WeatherForecastCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubWeatherForecastProvider } from "#test/doubles/weather/stub-weather-forecast-provider";
import { forecastTimingFixture, weatherForecastFixture } from "#test/fixtures/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { ForecastTiming } from "../ports/weather-forecast-provider.port.js";
import { ReadWeatherForecastsUseCase } from "./read-weather-forecasts.use-case.js";

/** 요청 날짜의 KST 09:00 */
const target = Temporal.Instant.from("2026-07-23T00:00:00.000Z");

class ConcurrencyTrackingWeatherProvider extends StubWeatherForecastProvider {
  active = 0;
  maxActive = 0;

  override async getForecast(grid: GridCoordinate, timing: ForecastTiming) {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await Promise.resolve();
      return await super.getForecast(grid, timing);
    } finally {
      this.active -= 1;
    }
  }
}

function setup(now: Temporal.Instant, weatherProvider = new StubWeatherForecastProvider()) {
  // 예보 제공 범위와 캐시 TTL이 같은 시계를 보도록 Date 가짜 시계를 함께 옮긴다
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now.epochMilliseconds);
  suppressLogger();
  const cache = new WeatherForecastCache(
    new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
  const useCase = new ReadWeatherForecastsUseCase({
    weatherProvider,
    weatherCache: cache,
    logger: new SilentLogger(),
    clock: new FakeTimerClock(),
  });
  return { cache, weatherProvider, useCase };
}

describe("ReadWeatherForecastsUseCase — 격자 묶음 예보", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hit은 다시 부르지 않고 miss의 성공·latest·누락을 격자별로 돌려준다", async () => {
    // Given
    const { cache, weatherProvider, useCase } = setup(target);
    const grids = [
      { gridX: 60, gridY: 127 },
      { gridX: 98, gridY: 76 },
      { gridX: 52, gridY: 38 },
      { gridX: 89, gridY: 90 },
    ];
    const hit = weatherForecastFixture({ temperatureMax: 11 });
    const fresh = weatherForecastFixture({ temperatureMax: 22 });
    const latestDate = Temporal.Instant.from("2026-07-22T00:00:00.000Z");
    const latest = weatherForecastFixture({ date: latestDate, temperatureMax: 33 });
    await cache.saveForecastBatch(
      [{ grid: GridCoordinate.create(60, 127), forecast: hit }],
      forecastTimingFixture(target),
    );
    await cache.saveForecastBatch(
      [{ grid: GridCoordinate.create(52, 38), forecast: latest }],
      forecastTimingFixture(latestDate),
    );
    weatherProvider.results.set("98:76", fresh);
    weatherProvider.results.set("52:38", new Error("jeju down"));
    weatherProvider.results.set("89:90", new Error("no fallback"));

    // When
    const result = await useCase.execute({ grids, target });

    // Then
    expect(result.size).toBe(3);
    expect(result.get("60:127")?.temperatureMax).toBe(11);
    expect(result.get("98:76")?.temperatureMax).toBe(22);
    expect(result.get("52:38")?.temperatureMax).toBe(33);
    expect(result.has("89:90")).toBe(false);
    expect(weatherProvider.calls.map(({ gridX, gridY }) => ({ gridX, gridY }))).toEqual(
      grids.slice(1),
    );
    const timing = forecastTimingFixture(target);
    expect(await cache.getForecast(GridCoordinate.create(98, 76), timing)).toEqual(fresh);
    expect(await cache.getForecast(GridCoordinate.create(52, 38), timing)).toBeUndefined();
    expect(await cache.getForecast(GridCoordinate.create(89, 90), timing)).toBeUndefined();
  });

  it("miss는 공급자를 최대 4개씩 동시에 부르고 모든 격자의 결과를 저장한다", async () => {
    // Given
    const tracking = new ConcurrencyTrackingWeatherProvider();
    const { cache, useCase } = setup(target, tracking);
    const grids = Array.from({ length: 10 }, (_, i) => ({ gridX: 50 + i, gridY: 100 }));
    tracking.results.set("55:100", new Error("transient"));

    // When
    const result = await useCase.execute({ grids, target });

    // Then
    expect(tracking.maxActive).toBe(4);
    expect(tracking.calls.map(({ gridX }) => gridX)).toEqual(grids.map(({ gridX }) => gridX));
    expect(result.size).toBe(9);
    expect(result.has("55:100")).toBe(false);
    expect(
      await cache.getForecast(GridCoordinate.create(59, 100), forecastTimingFixture(target)),
    ).toEqual(result.get("59:100"));
  });

  it("빈 묶음은 빈 Map이고 공급자에 접근하지 않는다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(target);

    // When
    const result = await useCase.execute({ grids: [], target });

    // Then
    expect(result.size).toBe(0);
    expect(weatherProvider.calls).toEqual([]);
  });

  it("공급자가 줄 수 없는 날짜면 부르지 않고 빈 결과다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(Temporal.Instant.from("2026-11-01T19:18:00.000Z"));

    // When
    const result = await useCase.execute({
      grids: [{ gridX: 60, gridY: 127 }],
      target: Temporal.Instant.from("2026-11-06T00:00:00Z"),
    });

    // Then
    expect(result.size).toBe(0);
    expect(weatherProvider.calls).toEqual([]);
  });
});
