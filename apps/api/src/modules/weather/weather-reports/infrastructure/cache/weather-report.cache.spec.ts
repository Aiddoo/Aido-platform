import { GeoCell } from "#api/modules/weather/shared/domain/geo-cell.vo";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { StubWeatherProviderBudget } from "#test/doubles/weather/stub-weather-provider-budget";
import { createWeatherReportFixture } from "#test/fixtures/weather/weather-report.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { WeatherReportPrimitives } from "../../domain/weather-report.aggregate.js";
import { WeatherReportCache } from "./weather-report.cache.js";
import { WeatherReportCacheKey } from "./weather-report.keyspace.js";

const NOW = Temporal.Instant.from("2026-11-02T06:20:00.000Z");
const CELL = GeoCell.reconstitute("wydm9");
const MINUTE_MS = 60_000;

const minuteForecast = {
  periods: [],
  minutes: [{ startsAt: NOW, precipitationChance: 0, precipitationIntensity: 0 }],
} satisfies WeatherReportPrimitives["nextHour"];

function rainyInOneHour(overrides: Partial<WeatherReportPrimitives> = {}) {
  const base = createWeatherReportFixture({ fetchedAt: NOW });
  return createWeatherReportFixture({
    fetchedAt: NOW,
    hourly: base.hourly.map((hour, index) =>
      index === 1 ? { ...hour, precipitationChance: 70, precipitationType: "RAIN" } : hour,
    ),
    ...overrides,
  });
}

describe("WeatherReportCache — 리포트 보관 시간과 만료 시각", () => {
  let memory: InMemoryCacheStore;
  let budget: StubWeatherProviderBudget;
  let cache: WeatherReportCache;

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW.epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: MINUTE_MS, maxItems: 100 });
    budget = new StubWeatherProviderBudget();
    cache = new WeatherReportCache(memory, new FakeTimerClock(), budget);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function storedTtlMinutes(
    report: ReturnType<typeof createWeatherReportFixture>,
  ): Promise<number> {
    await cache.getOrLoadReport(CELL, "shared", async () => report);
    return (await memory.ttl(WeatherReportCacheKey.report(CELL.key, "shared"))) / MINUTE_MS;
  }

  it.each([
    { name: "만료를 모르면", validUntil: null, expected: 30 },
    { name: "공급자 예보가 20분 뒤 만료되면", validUntil: NOW.add({ minutes: 20 }), expected: 20 },
    { name: "3분 뒤 만료되면 하한", validUntil: NOW.add({ minutes: 3 }), expected: 10 },
    { name: "이미 만료됐으면 하한", validUntil: NOW.subtract({ minutes: 5 }), expected: 10 },
    { name: "2시간 뒤 만료되면 상한", validUntil: NOW.add({ hours: 2 }), expected: 30 },
  ])("곧 강수가 아니고 $name $expected분 둔다", async ({ validUntil, expected }) => {
    // Given
    const report = createWeatherReportFixture({ fetchedAt: NOW, validUntil });

    // When
    const ttlMinutes = await storedTtlMinutes(report);

    // Then
    expect(ttlMinutes).toBe(expected);
  });

  it("분 단위 예보가 있는 칸에 2시간 안 강수가 예보되면 공급자 만료보다 짧게 10분 둔다", async () => {
    // Given
    const report = rainyInOneHour({
      nextHour: minuteForecast,
      validUntil: NOW.add({ minutes: 25 }),
    });

    // When
    const ttlMinutes = await storedTtlMinutes(report);

    // Then
    expect(ttlMinutes).toBe(10);
  });

  it("분 단위 예보가 없는 칸(한국)은 2시간 안 강수가 예보돼도 평소처럼 30분 둔다", async () => {
    // Given
    const report = rainyInOneHour({ nextHour: null });

    // When
    const ttlMinutes = await storedTtlMinutes(report);

    // Then
    expect(ttlMinutes).toBe(30);
  });

  it("분 단위 예보가 없는 칸도 지금 강수 중이면 10분 둔다", async () => {
    // Given
    const base = createWeatherReportFixture({ fetchedAt: NOW });
    const report = createWeatherReportFixture({
      fetchedAt: NOW,
      current: { ...base.current, precipitationIntensity: 0.6 },
    });

    // When
    const ttlMinutes = await storedTtlMinutes(report);

    // Then
    expect(ttlMinutes).toBe(10);
  });

  it.each(["saving", "exhausted"] as const)(
    "공급자 월 예산이 %s이면 곧 강수여도 2시간 둔다",
    async (state) => {
      // Given
      budget.state = state;
      const report = rainyInOneHour({ nextHour: minuteForecast });

      // When
      const ttlMinutes = await storedTtlMinutes(report);

      // Then
      expect(ttlMinutes).toBe(120);
    },
  );

  it("캐시에서 읽어도 처음 저장할 때 정한 만료 시각을 돌려준다", async () => {
    // Given
    const report = createWeatherReportFixture({
      fetchedAt: NOW,
      validUntil: NOW.add({ minutes: 20 }),
    });
    await cache.getOrLoadReport(CELL, "shared", async () => report);
    vi.setSystemTime(NOW.add({ minutes: 5 }).epochMilliseconds);

    // When
    const cached = await cache.getOrLoadReport(CELL, "shared", async () => {
      throw new Error("캐시가 있으면 부르지 않는다");
    });

    // Then
    expect(cached.expiresAt).toEqual(NOW.add({ minutes: 20 }));
    expect(cached.report.validUntil).toEqual(NOW.add({ minutes: 20 }));
  });

  it("마지막 성공 리포트는 칸 리포트가 만료된 뒤에도 6시간 남는다", async () => {
    // Given
    const report = createWeatherReportFixture({ fetchedAt: NOW });
    await cache.getOrLoadReport(CELL, "shared", async () => report);
    vi.setSystemTime(NOW.add({ hours: 5, minutes: 59 }).epochMilliseconds);

    // When
    const latest = await cache.findLatestReport(CELL, "shared");

    // Then
    expect(latest?.fetchedAt).toEqual(NOW);
    expect(latest?.id.value).toBe(CELL.key);
  });
});

describe("WeatherReportCache — 대기질", () => {
  let memory: InMemoryCacheStore;
  let cache: WeatherReportCache;
  let loads: number;

  beforeEach(() => {
    suppressLogger();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW.epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: MINUTE_MS, maxItems: 100 });
    cache = new WeatherReportCache(memory, new FakeTimerClock(), new StubWeatherProviderBudget());
    loads = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function counting<T>(load: () => Promise<T>): () => Promise<T> {
    return () => {
      loads++;
      return load();
    };
  }

  it("측정값은 1시간 저장해 그동안 다시 부르지 않는다", async () => {
    // Given
    const load = counting(async () => ({ pm10: 32, pm25: 18 }));
    await cache.getOrLoadAirQuality(CELL, load);
    vi.setSystemTime(NOW.add({ minutes: 59 }).epochMilliseconds);

    // When
    const cached = await cache.getOrLoadAirQuality(CELL, load);

    // Then
    expect(cached).toEqual({ pm10: 32, pm25: 18 });
    expect(loads).toBe(1);
  });

  it("측정 없음(null)은 30분 저장하고 그 뒤 다시 부른다", async () => {
    // Given
    const load = counting(async () => null);
    await cache.getOrLoadAirQuality(CELL, load);
    vi.setSystemTime(NOW.add({ minutes: 29 }).epochMilliseconds);
    const duringNoData = await cache.getOrLoadAirQuality(CELL, load);
    const loadsDuringNoData = loads;
    vi.setSystemTime(NOW.add({ minutes: 30, seconds: 1 }).epochMilliseconds);

    // When
    await cache.getOrLoadAirQuality(CELL, load);

    // Then
    expect(duringNoData).toBeNull();
    expect(loadsDuringNoData).toBe(1);
    expect(loads).toBe(2);
  });

  it("조회 실패는 저장하지 않아 다음 요청이 바로 다시 부른다", async () => {
    // Given
    const failing = counting(async () => {
      throw new Error("airkorea 500");
    });
    await expect(cache.getOrLoadAirQuality(CELL, failing)).rejects.toThrow();

    // When
    const recovered = await cache.getOrLoadAirQuality(
      CELL,
      counting(async () => ({ pm10: 10, pm25: 5 })),
    );

    // Then
    expect(recovered).toEqual({ pm10: 10, pm25: 5 });
    expect(loads).toBe(2);
  });
});
