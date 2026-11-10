import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { kmaTimingFixture } from "#test/fixtures/weather.fixture";
import { FakeWeatherProvider } from "#test/mocks/fake-weather.provider";
import { suppressLogger } from "#test/setup/suppress-logger";

import { WeatherForecastCache } from "../../../forecasts/infrastructure/cache/weather-forecast.cache.js";
import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { ForecastGridCacheInvalidatorAdapter } from "./forecast-grid-cache-invalidator.adapter.js";

const at = new Date("2026-07-23T00:00:00Z");
const next = new Date("2026-07-24T00:00:00Z");
const conditions = {
  feelsLikeTemperature: 25,
  uvIndex: 7,
  sunrise: "05:23",
  sunset: "19:00",
  pm10: 15,
  pm25: 7,
};

describe("ForecastGridCacheInvalidatorAdapter — 격자 예보 캐시 무효화", () => {
  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("모든 발표·조건 날짜와 latest를 지우고 다른 격자는 보존한다", async () => {
    // Given
    const memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const weather = new WeatherForecastCache(memory);
    const forecast = await new FakeWeatherProvider().getForecast(
      37.5665,
      126.978,
      kmaTimingFixture(at),
    );
    await weather.saveForecastBatch([{ gridX: 60, gridY: 127, forecast }], kmaTimingFixture(at));
    await weather.saveForecastBatch([{ gridX: 60, gridY: 127, forecast }], kmaTimingFixture(next));
    await weather.setConditions(60, 127, at, conditions);
    await weather.setConditions(60, 127, next, conditions);
    await weather.setConditions(60, 128, at, conditions);
    const invalidator = new ForecastGridCacheInvalidatorAdapter(memory);

    // When
    await invalidator.invalidateGrid(GridCoordinate.create(60, 127));

    // Then
    expect(await weather.getForecast(60, 127, kmaTimingFixture(at))).toBeUndefined();
    expect(await weather.getForecast(60, 127, kmaTimingFixture(next))).toBeUndefined();
    expect(await weather.getLatestForecast(60, 127)).toBeUndefined();
    expect(await weather.getConditions(60, 127, at)).toBeUndefined();
    expect(await weather.getConditions(60, 127, next)).toBeUndefined();
    expect(await weather.getConditions(60, 128, at)).toEqual(conditions);
  });
});
