import { ErrorCode } from "@aido/api/errors";

import { WeatherForecastCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-forecast.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubWeatherForecastProvider } from "#test/doubles/weather/stub-weather-forecast-provider";
import { forecastTimingFixture, weatherForecastFixture } from "#test/fixtures/weather.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { ReadWeatherForecastUseCase } from "./read-weather-forecast.use-case.js";

const SEOUL = GridCoordinate.create(60, 127);

function setup(now: Temporal.Instant) {
  // 예보 제공 범위와 캐시 TTL이 같은 시계를 보도록 Date 가짜 시계를 함께 옮긴다
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now.epochMilliseconds);
  suppressLogger();
  const cache = new WeatherForecastCache(
    new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
  const weatherProvider = new StubWeatherForecastProvider();
  const useCase = new ReadWeatherForecastUseCase({
    weatherProvider,
    weatherCache: cache,
    logger: new SilentLogger(),
    clock: new FakeTimerClock(),
  });
  return { cache, weatherProvider, useCase };
}

describe("ReadWeatherForecastUseCase — 캐시·latest 폴백", () => {
  /** 요청 날짜의 KST 09:00 */
  const target = Temporal.Instant.from("2026-07-23T00:00:00.000Z");
  const previous = Temporal.Instant.from("2026-07-22T00:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("현재 발표 cache가 있으면 공급자에 접근하지 않고 값을 반환한다", async () => {
    // Given
    const { cache, weatherProvider, useCase } = setup(target);
    const cached = weatherForecastFixture({ temperatureMax: 17 });
    await cache.saveForecastBatch(
      [{ grid: SEOUL, forecast: cached }],
      forecastTimingFixture(target),
    );

    // When
    const result = await useCase.execute({ grid: SEOUL, target });

    // Then
    expect(result).toEqual(cached);
    expect(weatherProvider.calls).toEqual([]);
  });

  it("공급자 성공 결과를 정규·latest cache에 저장하고 재조회는 cache를 쓴다", async () => {
    // Given
    const { cache, weatherProvider, useCase } = setup(target);

    // When
    const first = await useCase.execute({ grid: SEOUL, target });
    const second = await useCase.execute({ grid: SEOUL, target });

    // Then
    expect(second).toEqual(first);
    expect(await cache.getForecast(SEOUL, forecastTimingFixture(target))).toEqual(first);
    expect(await cache.getLatestForecast(SEOUL)).toEqual(first);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("공급자 실패 시 이전 발표 latest를 반환한다", async () => {
    // Given
    const { cache, weatherProvider, useCase } = setup(target);
    const saved = weatherForecastFixture({ date: previous, temperatureMax: 18 });
    await cache.saveForecastBatch(
      [{ grid: SEOUL, forecast: saved }],
      forecastTimingFixture(previous),
    );
    weatherProvider.failure = new Error("provider down");

    // When
    const result = await useCase.execute({ grid: SEOUL, target });

    // Then
    expect(result).toEqual(saved);
    expect(weatherProvider.calls).toHaveLength(1);
  });

  it("같은 격자를 동시에 물으면 공급자를 한 번만 부르고 같은 예보를 나눠 쓴다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(target);

    // When
    const results = await Promise.all([
      useCase.execute({ grid: SEOUL, target }),
      useCase.execute({ grid: SEOUL, target }),
      useCase.execute({ grid: SEOUL, target }),
    ]);

    // Then
    expect(weatherProvider.calls).toHaveLength(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it("실패한 격자는 1분 동안 공급자를 부르지 않고 latest로 넘어가고 1분 뒤 다시 부른다", async () => {
    // Given
    const { cache, weatherProvider, useCase } = setup(target);
    const saved = weatherForecastFixture({ date: previous, temperatureMax: 18 });
    await cache.saveForecastBatch(
      [{ grid: SEOUL, forecast: saved }],
      forecastTimingFixture(previous),
    );
    weatherProvider.failure = new Error("provider down");
    await useCase.execute({ grid: SEOUL, target });

    // When
    const duringCooldown = await useCase.execute({ grid: SEOUL, target });
    const callsDuringCooldown = weatherProvider.calls.length;
    vi.setSystemTime(target.epochMilliseconds + 61_000);
    weatherProvider.failure = null;
    const recovered = await useCase.execute({ grid: SEOUL, target });

    // Then
    expect(duringCooldown).toEqual(saved);
    expect(callsDuringCooldown).toBe(1);
    expect(weatherProvider.calls).toHaveLength(2);
    expect(recovered.temperatureMax).not.toBe(18);
  });

  it("공급자 실패와 latest 없음이 겹치면 WEATHER_1901을 반환한다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(target);
    weatherProvider.failure = new Error("provider down");

    // When
    const result = useCase.execute({ grid: SEOUL, target });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
  });
});

describe("ReadWeatherForecastUseCase — 공급자 제공 범위 (#1156)", () => {
  /** 운영에서 503이 난 시각: KST 2026-11-02 04:18 */
  const now = Temporal.Instant.from("2026-11-01T19:18:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("아침 발표 전 오늘 날짜 요청은 지금의 발표로 조회해 정상 예보를 준다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(now);
    const today = Temporal.Instant.from("2026-11-02T00:00:00.000Z");

    // When
    const forecast = await useCase.execute({ grid: SEOUL, target: today });

    // Then
    expect(forecast.date).toEqual(today);
    expect(weatherProvider.calls).toEqual([
      { gridX: 60, gridY: 127, target: today, issuance: now },
    ]);
  });

  it.each([
    ["3일보다 오래된 날짜", "2026-10-30"],
    ["모레보다 먼 날짜", "2026-11-05"],
  ])("%s는 공급자를 부르지 않고 400 SYS_0002다", async (_case, day) => {
    // Given
    const { weatherProvider, useCase } = setup(now);
    const requested = Temporal.Instant.from(`${day}T00:00:00.000Z`);

    // When
    const result = useCase.execute({ grid: SEOUL, target: requested });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(weatherProvider.calls).toEqual([]);
  });

  it("같은 발표를 쓰더라도 대상 날짜가 다르면 캐시를 나눈다", async () => {
    // Given
    const { weatherProvider, useCase } = setup(now);
    const today = Temporal.Instant.from("2026-11-02T00:00:00.000Z");
    const tomorrow = Temporal.Instant.from("2026-11-03T00:00:00.000Z");

    // When
    await useCase.execute({ grid: SEOUL, target: today });
    await useCase.execute({ grid: SEOUL, target: tomorrow });

    // Then
    expect(weatherProvider.calls.map((call) => call.target)).toEqual([today, tomorrow]);
    expect(weatherProvider.calls.map((call) => call.issuance)).toEqual([now, now]);
  });
});
