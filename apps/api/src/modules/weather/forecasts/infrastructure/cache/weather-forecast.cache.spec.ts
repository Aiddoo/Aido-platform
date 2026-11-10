import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { kmaTimingFixture } from "#test/fixtures/weather.fixture";
import { FakeWeatherProvider } from "#test/mocks/fake-weather.provider";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { WeatherConditions } from "../../application/read-models/weather-forecast.read-model.js";
import { WeatherForecastCache } from "./weather-forecast.cache.js";

const at = new Date("2026-07-23T00:00:00Z");
const next = new Date("2026-07-24T00:00:00Z");
const conditions: WeatherConditions = {
  feelsLikeTemperature: 25,
  uvIndex: 7,
  sunrise: "05:23",
  sunset: "19:00",
  pm10: 15,
  pm25: 7,
};

describe("Weather 캐시 날짜·배치·TTL (실제 캐시 어댑터)", () => {
  let memory: InMemoryCacheStore;
  let weather: WeatherForecastCache;

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    weather = new WeatherForecastCache(memory);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 KST 날짜는 hit이고 다른 날짜는 이전 일출입을 재사용하지 않는다", async () => {
    // Given
    await weather.setConditions(60, 127, at, conditions);
    // When / Then
    expect(await weather.getConditions(60, 127, new Date("2026-07-23T10:00:00Z"))).toEqual(
      conditions,
    );
    expect(await weather.getConditions(60, 127, next)).toBeUndefined();
    await weather.setConditions(60, 127, next, { ...conditions, sunrise: "05:24" });
    expect((await weather.getConditions(60, 127, at))?.sunrise).toBe("05:23");
    expect((await weather.getConditions(60, 127, next))?.sunrise).toBe("05:24");
  });

  it("KST 자정 전후는 서로 다른 날짜이며 UTC 같은 날짜라도 캐시를 분리한다", async () => {
    // Given
    const before = new Date("2026-07-23T14:59:59Z");
    const after = new Date("2026-07-23T15:00:00Z");
    await weather.setConditions(60, 127, before, conditions);
    // When / Then
    expect(await weather.getConditions(60, 127, after)).toBeUndefined();
  });

  it("조건 1시간·정규 3시간·latest 24시간 TTL을 유지한다", async () => {
    // Given
    const forecast = await new FakeWeatherProvider().getForecast(
      37.5665,
      126.978,
      kmaTimingFixture(at),
    );
    await weather.setConditions(60, 127, at, conditions);
    await weather.saveForecastBatch(
      [{ gridX: 60, gridY: 127, forecast: forecast }],
      kmaTimingFixture(at),
    );
    // When / Then
    vi.setSystemTime(at.getTime() + 60 * 60_000 + 1);
    expect(await weather.getConditions(60, 127, at)).toBeUndefined();
    expect(await weather.getForecast(60, 127, kmaTimingFixture(at))).toEqual(forecast);
    vi.setSystemTime(at.getTime() + 3 * 60 * 60_000 + 1);
    expect(await weather.getForecast(60, 127, kmaTimingFixture(at))).toBeUndefined();
    expect(await weather.getLatestForecast(60, 127)).toEqual(forecast);
    vi.setSystemTime(at.getTime() + 24 * 60 * 60_000 + 1);
    expect(await weather.getLatestForecast(60, 127)).toBeUndefined();
  });

  it("배치 캐시는 조회 순서와 miss 자리를 유지하고 latest도 함께 저장한다", async () => {
    // Given
    const fake = new FakeWeatherProvider();
    const seoul = await fake.getForecast(37.5665, 126.978, kmaTimingFixture(at));
    const busan = {
      ...(await fake.getForecast(35.1796, 129.0756, kmaTimingFixture(at))),
      temperatureMax: 30,
    };
    await weather.saveForecastBatch(
      [
        { gridX: 60, gridY: 127, forecast: seoul },
        { gridX: 98, gridY: 76, forecast: busan },
      ],
      kmaTimingFixture(at),
    );
    const grids = [
      { gridX: 98, gridY: 76 },
      { gridX: 53, gridY: 38 },
      { gridX: 60, gridY: 127 },
    ];
    // When / Then
    expect(await weather.getForecastBatch(grids, kmaTimingFixture(at))).toEqual([
      busan,
      undefined,
      seoul,
    ]);
    expect(await weather.getLatestForecastBatch(grids)).toEqual([busan, undefined, seoul]);
    expect(
      await weather.getForecastBatch(grids, kmaTimingFixture(new Date("2026-07-23T02:15:00Z"))),
    ).toEqual([undefined, undefined, undefined]);
  });
});
