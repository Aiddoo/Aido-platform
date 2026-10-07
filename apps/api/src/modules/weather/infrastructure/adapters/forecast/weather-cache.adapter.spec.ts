import { InMemoryCacheAdapter } from "#api/platform/cache/adapters/in-memory-cache.adapter";
import { CacheService } from "#api/platform/cache/cache.service";
import { FakeWeatherProvider } from "#test/mocks/fake-weather.provider";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { WeatherConditions } from "../../../application/ports/forecast/weather-provider.port.js";
import { WeatherCacheKey } from "../../cache/forecast/weather-cache.keyspace.js";
import { WeatherCacheAdapter } from "./weather-cache.adapter.js";

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
  let memory: InMemoryCacheAdapter;
  let cache: CacheService;
  let weather: WeatherCacheAdapter;

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    memory = new InMemoryCacheAdapter({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new CacheService(memory);
    weather = new WeatherCacheAdapter(cache);
  });

  afterEach(() => {
    memory.onModuleDestroy();
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

  it("날짜가 없는 legacy 조건 캐시는 읽지 않는다", async () => {
    // Given
    await cache.set(WeatherCacheKey.legacyConditions(60, 127), conditions);
    // When / Then
    expect(await weather.getConditions(60, 127, at)).toBeUndefined();
  });

  it("조건 1시간·정규 3시간·latest 24시간 TTL을 유지한다", async () => {
    // Given
    const forecast = await new FakeWeatherProvider().getForecast(37.5665, 126.978, at);
    await weather.setConditions(60, 127, at, conditions);
    await weather.saveForecast(60, 127, at, forecast);
    // When / Then
    vi.setSystemTime(at.getTime() + 60 * 60_000 + 1);
    expect(await weather.getConditions(60, 127, at)).toBeUndefined();
    expect(await weather.getForecast(60, 127, at)).toEqual(forecast);
    vi.setSystemTime(at.getTime() + 3 * 60 * 60_000 + 1);
    expect(await weather.getForecast(60, 127, at)).toBeUndefined();
    expect(await weather.getLatestForecast(60, 127)).toEqual(forecast);
    vi.setSystemTime(at.getTime() + 24 * 60 * 60_000 + 1);
    expect(await weather.getLatestForecast(60, 127)).toBeUndefined();
  });

  it("배치 캐시는 조회 순서와 miss 자리를 유지하고 latest도 함께 저장한다", async () => {
    // Given
    const fake = new FakeWeatherProvider();
    const seoul = await fake.getForecast(37.5665, 126.978, at);
    const busan = { ...(await fake.getForecast(35.1796, 129.0756, at)), temperatureMax: 30 };
    await weather.saveForecastBatch(
      [
        { gridX: 60, gridY: 127, forecast: seoul },
        { gridX: 98, gridY: 76, forecast: busan },
      ],
      at,
    );
    const grids = [
      { gridX: 98, gridY: 76 },
      { gridX: 53, gridY: 38 },
      { gridX: 60, gridY: 127 },
    ];
    // When / Then
    expect(await weather.getForecastBatch(grids, at)).toEqual([busan, undefined, seoul]);
    expect(await weather.getLatestForecastBatch(grids)).toEqual([busan, undefined, seoul]);
    expect(await weather.getForecastBatch(grids, new Date("2026-07-23T02:15:00Z"))).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("격자 무효화는 모든 발표·조건 날짜와 legacy를 지우고 다른 격자는 보존한다", async () => {
    // Given
    const forecast = await new FakeWeatherProvider().getForecast(37.5665, 126.978, at);
    await weather.saveForecast(60, 127, at, forecast);
    await weather.saveForecast(60, 127, next, forecast);
    await weather.setConditions(60, 127, at, conditions);
    await weather.setConditions(60, 127, next, conditions);
    await cache.set(WeatherCacheKey.legacyConditions(60, 127), conditions);
    await weather.setConditions(60, 128, at, conditions);
    // When
    await weather.invalidateGrid(60, 127);
    // Then
    expect(await weather.getForecast(60, 127, at)).toBeUndefined();
    expect(await weather.getForecast(60, 127, next)).toBeUndefined();
    expect(await weather.getLatestForecast(60, 127)).toBeUndefined();
    expect(await weather.getConditions(60, 127, at)).toBeUndefined();
    expect(await weather.getConditions(60, 127, next)).toBeUndefined();
    expect(await cache.get(WeatherCacheKey.legacyConditions(60, 127))).toBeUndefined();
    expect(await weather.getConditions(60, 128, at)).toEqual(conditions);
  });
});
