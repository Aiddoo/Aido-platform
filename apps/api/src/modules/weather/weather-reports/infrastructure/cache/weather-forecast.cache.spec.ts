import { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import {
  createForecastTimingFixture,
  createWeatherForecastFixture,
} from "#test/fixtures/weather/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { WeatherConditionsReadModel } from "../../application/read-models/weather-forecast.read-model.js";
import { WeatherForecastCache } from "./weather-forecast.cache.js";

const at = Temporal.Instant.from("2026-07-23T00:00:00Z");
const next = Temporal.Instant.from("2026-07-24T00:00:00Z");
const SEOUL = GridCoordinate.create(60, 127);
const STORED_DATE_SCHEMA = z.looseObject({ date: z.string() });
const conditions: WeatherConditionsReadModel = {
  feelsLikeTemperature: 25,
  uvIndex: 7,
  sunrise: "05:23",
  sunset: "19:00",
  pm10: 15,
  pm25: 7,
};

describe("WeatherForecastCache — 날짜·TTL (실제 캐시 어댑터)", () => {
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
    const timing = createForecastTimingFixture(
      Temporal.Instant.from("2026-04-02T00:00:00Z"),
      Temporal.Instant.from("2026-04-01T00:00:00Z"),
    );
    const forecast = createWeatherForecastFixture({ date: timing.target });

    // When
    await weather.getOrLoadForecast(SEOUL, timing, async () => forecast);
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
    const sameDay = await weather.findConditions(
      SEOUL,
      Temporal.Instant.from("2026-07-23T10:00:00Z"),
    );
    const nextDay = await weather.findConditions(SEOUL, next);
    await weather.setConditions(SEOUL, next, { ...conditions, sunrise: "05:24" });

    // Then
    expect(sameDay).toEqual(conditions);
    expect(nextDay).toBeNull();
    expect((await weather.findConditions(SEOUL, at))?.sunrise).toBe("05:23");
    expect((await weather.findConditions(SEOUL, next))?.sunrise).toBe("05:24");
  });

  it("KST 자정 전후는 서로 다른 날짜이며 UTC 같은 날짜라도 캐시를 분리한다", async () => {
    // Given
    const before = Temporal.Instant.from("2026-07-23T14:59:59Z");
    const after = Temporal.Instant.from("2026-07-23T15:00:00Z");
    await weather.setConditions(SEOUL, before, conditions);

    // When
    const found = await weather.findConditions(SEOUL, after);

    // Then
    expect(found).toBeNull();
  });

  it("조건 1시간·정규 3시간·latest 24시간 TTL을 유지한다", async () => {
    // Given
    const forecast = createWeatherForecastFixture({ date: at });
    await weather.setConditions(SEOUL, at, conditions);
    await weather.getOrLoadForecast(SEOUL, createForecastTimingFixture(at), async () => forecast);

    // When
    vi.setSystemTime(at.epochMilliseconds + 60 * 60_000 + 1);
    const conditionsAfterHour = await weather.findConditions(SEOUL, at);
    const forecastAfterHour = await weather.findForecast(SEOUL, createForecastTimingFixture(at));
    vi.setSystemTime(at.epochMilliseconds + 3 * 60 * 60_000 + 1);
    const forecastAfterThreeHours = await weather.findForecast(
      SEOUL,
      createForecastTimingFixture(at),
    );
    const latestAfterThreeHours = await weather.findLatestForecast(SEOUL);
    vi.setSystemTime(at.epochMilliseconds + 24 * 60 * 60_000 + 1);
    const latestAfterDay = await weather.findLatestForecast(SEOUL);

    // Then
    expect(conditionsAfterHour).toBeNull();
    expect(forecastAfterHour).toEqual(forecast);
    expect(forecastAfterThreeHours).toBeNull();
    expect(latestAfterThreeHours).toEqual(forecast);
    expect(latestAfterDay).toBeNull();
  });
});
