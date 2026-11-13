import { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { forecastTimingFixture, weatherForecastFixture } from "#test/fixtures/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { WeatherConditions } from "../../application/read-models/weather-forecast.read-model.js";
import { WeatherForecastCache } from "./weather-forecast.cache.js";

const at = Temporal.Instant.from("2026-07-23T00:00:00Z");
const next = Temporal.Instant.from("2026-07-24T00:00:00Z");
const SEOUL = GridCoordinate.create(60, 127);
const BUSAN = GridCoordinate.create(98, 76);
const JEJU = GridCoordinate.create(53, 38);
const STORED_DATE_SCHEMA = z.looseObject({ date: z.string() });
const conditions: WeatherConditions = {
  feelsLikeTemperature: 25,
  uvIndex: 7,
  sunrise: "05:23",
  sunset: "19:00",
  pm10: 15,
  pm25: 7,
};

describe("WeatherForecastCache — 날짜·배치·TTL (실제 캐시 어댑터)", () => {
  let memory: InMemoryCacheStore;
  let weather: WeatherForecastCache;

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at.epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    weather = new WeatherForecastCache(memory);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("발표·대상 날짜에서 만든 Redis 키와 저장 값의 시각 문자열이 Date JSON 때와 같다", async () => {
    // Given
    const timing = forecastTimingFixture(
      Temporal.Instant.from("2026-04-02T00:00:00Z"),
      Temporal.Instant.from("2026-04-01T00:00:00Z"),
    );
    const forecast = weatherForecastFixture({ date: timing.target });

    // When
    await weather.saveForecastBatch([{ grid: SEOUL, forecast }], timing);
    await weather.setConditions(SEOUL, Temporal.Instant.from("2026-03-31T15:00:00Z"), conditions);

    // Then
    expect(await memory.has("aido:v1:weather:forecast:60:127:20260401:0800:2026-04-02")).toBe(true);
    expect(await memory.has("aido:v1:weather:forecast-latest:60:127")).toBe(true);
    expect(await memory.has("aido:v1:weather:conditions:60:127:2026-04-01")).toBe(true);
    const stored = await memory.get("aido:v1:weather:forecast-latest:60:127", STORED_DATE_SCHEMA);
    expect(stored?.date).toBe("2026-04-02T00:00:00.000Z");
  });

  it("같은 KST 날짜는 hit이고 다른 날짜는 이전 일출입을 재사용하지 않는다", async () => {
    // Given
    await weather.setConditions(SEOUL, at, conditions);

    // When
    const sameDay = await weather.getConditions(
      SEOUL,
      Temporal.Instant.from("2026-07-23T10:00:00Z"),
    );
    const nextDay = await weather.getConditions(SEOUL, next);
    await weather.setConditions(SEOUL, next, { ...conditions, sunrise: "05:24" });

    // Then
    expect(sameDay).toEqual(conditions);
    expect(nextDay).toBeUndefined();
    expect((await weather.getConditions(SEOUL, at))?.sunrise).toBe("05:23");
    expect((await weather.getConditions(SEOUL, next))?.sunrise).toBe("05:24");
  });

  it("KST 자정 전후는 서로 다른 날짜이며 UTC 같은 날짜라도 캐시를 분리한다", async () => {
    // Given
    const before = Temporal.Instant.from("2026-07-23T14:59:59Z");
    const after = Temporal.Instant.from("2026-07-23T15:00:00Z");
    await weather.setConditions(SEOUL, before, conditions);

    // When
    const found = await weather.getConditions(SEOUL, after);

    // Then
    expect(found).toBeUndefined();
  });

  it("조건 1시간·정규 3시간·latest 24시간 TTL을 유지한다", async () => {
    // Given
    const forecast = weatherForecastFixture({ date: at });
    await weather.setConditions(SEOUL, at, conditions);
    await weather.saveForecastBatch([{ grid: SEOUL, forecast }], forecastTimingFixture(at));

    // When
    vi.setSystemTime(at.epochMilliseconds + 60 * 60_000 + 1);
    const conditionsAfterHour = await weather.getConditions(SEOUL, at);
    const forecastAfterHour = await weather.getForecast(SEOUL, forecastTimingFixture(at));
    vi.setSystemTime(at.epochMilliseconds + 3 * 60 * 60_000 + 1);
    const forecastAfterThreeHours = await weather.getForecast(SEOUL, forecastTimingFixture(at));
    const latestAfterThreeHours = await weather.getLatestForecast(SEOUL);
    vi.setSystemTime(at.epochMilliseconds + 24 * 60 * 60_000 + 1);
    const latestAfterDay = await weather.getLatestForecast(SEOUL);

    // Then
    expect(conditionsAfterHour).toBeUndefined();
    expect(forecastAfterHour).toEqual(forecast);
    expect(forecastAfterThreeHours).toBeUndefined();
    expect(latestAfterThreeHours).toEqual(forecast);
    expect(latestAfterDay).toBeUndefined();
  });

  it("배치 캐시는 조회 순서와 miss 자리를 유지하고 latest도 함께 저장한다", async () => {
    // Given
    const seoul = weatherForecastFixture({ date: at });
    const busan = weatherForecastFixture({ date: at, temperatureMax: 30 });
    await weather.saveForecastBatch(
      [
        { grid: SEOUL, forecast: seoul },
        { grid: BUSAN, forecast: busan },
      ],
      forecastTimingFixture(at),
    );
    const grids = [BUSAN, JEJU, SEOUL];

    // When
    const current = await weather.getForecastBatch(grids, forecastTimingFixture(at));
    const latest = await weather.getLatestForecastBatch(grids);
    const otherIssuance = await weather.getForecastBatch(
      grids,
      forecastTimingFixture(Temporal.Instant.from("2026-07-23T02:15:00Z")),
    );

    // Then
    expect(current).toEqual([busan, undefined, seoul]);
    expect(latest).toEqual([busan, undefined, seoul]);
    expect(otherIssuance).toEqual([undefined, undefined, undefined]);
  });
});
