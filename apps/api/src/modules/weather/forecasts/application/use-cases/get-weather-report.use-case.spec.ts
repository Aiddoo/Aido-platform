import { ErrorCode } from "@aido/api/errors";

import { WeatherKitNotConfiguredError } from "#api/modules/weather/forecasts/infrastructure/adapters/weatherkit-token.adapter";
import { WeatherReportCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-report.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { toIsoString } from "#api/shared/domain/time/instant";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryScheduledTodoReader } from "#test/doubles/weather/in-memory-scheduled-todo.reader";
import { InMemoryUserLocationRepository } from "#test/doubles/weather/in-memory-user-location.repository";
import { StubAirQualityProvider } from "#test/doubles/weather/stub-air-quality-provider";
import { StubTimezoneResolver } from "#test/doubles/weather/stub-timezone-resolver";
import { StubWeatherReportProvider } from "#test/doubles/weather/stub-weather-report-provider";
import { weatherAttributionFixture, weatherReportFixture } from "#test/fixtures/weather.fixture";
import {
  createUserLocationFixture,
  weatherLocationFixture,
} from "#test/fixtures/weather/user-location.fixture";

import { GetWeatherReportUseCase } from "./get-weather-report.use-case.js";
import { ReadWeatherReportUseCase } from "./read-weather-report.use-case.js";

describe("GetWeatherReportUseCase — 칸 단위 캐시·폴백과 한국 대기질", () => {
  const now = Temporal.Instant.from("2026-11-02T06:20:00.000Z");
  let memory: InMemoryCacheStore;
  let cache: WeatherReportCache;
  let repository: InMemoryUserLocationRepository;
  let provider: StubWeatherReportProvider;
  let timezoneResolver: StubTimezoneResolver;
  let airQuality: StubAirQualityProvider;
  let logger: SilentLogger;
  let todos: InMemoryScheduledTodoReader;
  let useCase: GetWeatherReportUseCase;

  /** 캐시 TTL과 응답 시각이 같은 시계를 보도록 Date만 고정·이동한다. */
  function moveClockTo(iso: string): void {
    vi.setSystemTime(Temporal.Instant.from(iso).epochMilliseconds);
  }

  function rebuild(): GetWeatherReportUseCase {
    return new GetWeatherReportUseCase({
      userLocationRepository: repository,
      readWeatherReport: new ReadWeatherReportUseCase({
        weatherReportProvider: provider,
        weatherReportCache: cache,
        logger,
      }),
      weatherReportProvider: provider,
      weatherReportCache: cache,
      timezoneResolver,
      airQualityProvider: airQuality,
      scheduledTodoReader: todos,
      logger,
      clock: new FakeTimerClock(),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now.epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherReportCache(memory, new FakeTimerClock());
    repository = new InMemoryUserLocationRepository([weatherLocationFixture()]);
    provider = new StubWeatherReportProvider();
    timezoneResolver = new StubTimezoneResolver();
    airQuality = new StubAirQualityProvider();
    logger = new SilentLogger();
    todos = new InMemoryScheduledTodoReader();
    useCase = rebuild();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("위치가 없으면 공급자를 부르지 않고 WEATHER_1902다", async () => {
    // Given
    repository.clear();
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1902 });
    expect(provider.calls).toEqual([]);
  });

  it("칸 중심 좌표의 시간대·국가로 공급자를 부르고 저장 위치의 좌표·시간대로 응답한다", async () => {
    // Given
    airQuality.result = { pm10: 32, pm25: 18 };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(provider.calls).toEqual([
      {
        cellKey: "wydm9",
        request: { timezone: "Asia/Seoul", countryCode: "KR", language: "ko" },
      },
    ]);
    expect(timezoneResolver.coordinates[0]?.latitude).not.toBe(37.5665);
    expect(result.location).toEqual({
      latitude: 37.5665,
      longitude: 126.978,
      timezone: "Asia/Seoul",
    });
    expect(result.airQuality).toEqual({ pm10: 32, pm25: 18 });
    expect(airQuality.calls).toHaveLength(1);
    expect(airQuality.calls[0]?.lat).not.toBe(37.5665);
  });

  it("같은 칸·언어의 동시 요청은 공급자를 한 번만 부른다", async () => {
    // Given
    const input = { userId: "weather-user", language: "ko" as const };
    // When
    await Promise.all([useCase.execute(input), useCase.execute(input)]);
    // Then
    expect(provider.calls).toHaveLength(1);
  });

  it("2시간 안에 강수 예보가 없으면 30분 동안 캐시를 쓰고 그 뒤 공급자를 다시 부른다", async () => {
    // Given 맑은 리포트
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // When
    moveClockTo("2026-11-02T06:49:59.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko" });
    moveClockTo("2026-11-02T06:50:01.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(provider.calls).toHaveLength(2);
  });

  it("2시간 안에 강수 확률 50% 이상이면 10분만 캐시를 쓴다", async () => {
    // Given 1시간 뒤 강수 확률 70%
    const rainy = weatherReportFixture(now);
    provider.report = weatherReportFixture(now, {
      hourly: rainy.hourly.map((hour, index) =>
        index === 1 ? { ...hour, precipitationChance: 70, precipitationType: "RAIN" } : hour,
      ),
    });
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // When
    moveClockTo("2026-11-02T06:30:01.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(provider.calls).toHaveLength(2);
  });

  it("번역 문구가 없는 칸은 언어가 달라도 캐시를 함께 쓴다", async () => {
    // Given 특보를 제공하지 않는 칸(한국)
    provider.hasLocalizedContent = false;
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // When
    await useCase.execute({ userId: "weather-user", language: "en" });
    // Then
    expect(provider.calls).toHaveLength(1);
  });

  it("언어 공유 캐시를 쓰는 칸도 공급자 표기는 요청 언어를 따른다", async () => {
    // Given 특보를 제공하지 않는 칸에 한국어 요청이 먼저 캐시를 채운다
    provider.hasLocalizedContent = false;
    const korean = await useCase.execute({ userId: "weather-user", language: "ko" });
    // When
    const english = await useCase.execute({ userId: "weather-user", language: "en" });
    // Then
    expect(provider.calls).toHaveLength(1);
    expect(korean.attribution).toEqual(weatherAttributionFixture("ko"));
    expect(english.attribution).toEqual(weatherAttributionFixture("en"));
  });

  it("특보처럼 번역 문구가 있는 칸은 언어별로 캐시를 나눈다", async () => {
    // Given 특보를 제공하는 칸
    provider.hasLocalizedContent = true;
    await useCase.execute({ userId: "weather-user", language: "ko" });
    // When
    await useCase.execute({ userId: "weather-user", language: "en" });
    // Then
    expect(provider.calls.map((call) => call.request.language)).toEqual(["ko", "en"]);
  });

  it("캐시가 지나 공급자가 실패하면 6시간 안의 마지막 리포트를 응답 시각 기준으로 잘라 돌려준다", async () => {
    // Given
    provider.report = weatherReportFixture(now);
    await useCase.execute({ userId: "weather-user", language: "ko" });
    provider.failure = new Error("weatherkit 429");
    moveClockTo("2026-11-02T10:05:00.000Z");
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(result.report.fetchedAt).toEqual(now);
    expect(result.report.hourly[0]?.startsAt).toEqual(
      Temporal.Instant.from("2026-11-02T10:00:00.000Z"),
    );
    expect(provider.calls).toHaveLength(2);
    expect(logger.messages).toContainEqual({
      event: "weather.report.fallback_used",
      cellKey: "wydm9",
      fallback: true,
      fetchedAt: toIsoString(now),
    });
    expect(JSON.stringify(logger.messages)).not.toContain("37.5665");
  });

  it("마지막 성공이 6시간을 넘으면 폴백 없이 WEATHER_1901이다", async () => {
    // Given
    await useCase.execute({ userId: "weather-user", language: "ko" });
    provider.failure = new Error("weatherkit down");
    moveClockTo("2026-11-02T12:20:01.000Z");
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
  });

  it("공급자가 실패하고 마지막 리포트도 없으면 WEATHER_1901이다", async () => {
    // Given
    provider.failure = new Error("weatherkit down");
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(logger.messages).toContainEqual({
      event: "weather.report.unavailable",
      cellKey: "wydm9",
      fallback: false,
      errorType: "Error",
      errorCode: ErrorCode.WEATHER_1901,
    });
  });

  it("WeatherKit 자격 증명이 없어 칸 언어 판단부터 실패해도 500이 아닌 WEATHER_1901이다", async () => {
    // Given 자격 없음: 가용성 판단과 본 호출이 모두 같은 오류로 실패한다
    provider.localizationFailure = new WeatherKitNotConfiguredError();
    provider.failure = new WeatherKitNotConfiguredError();
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: "weather.report.unavailable",
        errorType: "WeatherKitNotConfiguredError",
      }),
    );
  });

  it("한국 밖 위치는 대기질 공급자를 부르지 않고 airQuality가 null이다", async () => {
    // Given
    repository.set(weatherLocationFixture("weather-user", "도쿄"));
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "en" });
    // Then
    expect(airQuality.calls).toEqual([]);
    expect(result.airQuality).toBeNull();
    expect(result.location.timezone).toBe("Asia/Tokyo");
  });

  it("한국 bbox 안이라도 국가가 한국이 아니면 대기질을 부르지 않는다", async () => {
    // Given
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(airQuality.calls).toEqual([]);
    expect(result.airQuality).toBeNull();
  });

  it("대기질 조회가 실패해도 리포트는 성공하고 airQuality만 null이다", async () => {
    // Given
    airQuality.failure = new Error("airkorea down");
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(result.airQuality).toBeNull();
    expect(result.report.current.temperature).toBe(12.4);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: "weather.report.air_quality_unavailable",
        cellKey: "wydm9",
      }),
    );
  });

  it("v2 이전에 저장돼 시간대가 없는 위치는 칸 시간대로 응답한다", async () => {
    // Given
    repository.set(createUserLocationFixture({ userId: "weather-user", timezone: null }));
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(result.location.timezone).toBe("Asia/Seoul");
  });

  it("응답 시간대는 저장된 위치 시간대가 아니라 일별 date를 정한 칸 중심 시간대다", async () => {
    // Given 저장 시간대와 칸 중심 시간대가 다르다(시간대 경계 근처)
    repository.set(createUserLocationFixture({ userId: "weather-user", timezone: "Asia/Tokyo" }));
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko" });
    // Then
    expect(result.location.timezone).toBe("Asia/Seoul");
  });

  describe("briefing", () => {
    const TODAY_END = "2026-11-02T15:00:00.000Z";

    function rainyReport() {
      const base = weatherReportFixture(now);
      return weatherReportFixture(now, {
        hourly: base.hourly.map((hour) => ({ ...hour, precipitationChance: 80 })),
      });
    }

    it("남은 오늘 할 일 중 비 오는 시간에 걸린 것을 영향받는 할 일로 담는다", async () => {
      // Given
      provider.report = rainyReport();
      todos = new InMemoryScheduledTodoReader([
        {
          userId: "weather-user",
          id: 7,
          scheduledAt: Temporal.Instant.from("2026-11-02T07:30:00Z"),
        },
        { userId: "weather-user", id: 8, scheduledAt: Temporal.Instant.from(TODAY_END) },
        { userId: "other-user", id: 9, scheduledAt: Temporal.Instant.from("2026-11-02T07:30:00Z") },
      ]);
      useCase = rebuild();

      // When
      const result = await useCase.execute({
        userId: "weather-user",
        language: "ko",
        timezone: "Asia/Seoul",
      });

      // Then - 서울 오늘(15:00Z까지)만 보므로 자정 이후 할 일과 다른 사용자의 할 일은 빠진다
      expect(result.briefing?.reason).toBe("rain");
      expect(result.briefing?.affectedTodoIds).toEqual([7]);
    });

    it("할 일 조회가 실패하면 briefing만 빠지고 리포트는 성공한다", async () => {
      // Given
      todos.failure = new Error("db down");

      // When
      const result = await useCase.execute({ userId: "weather-user", language: "ko" });

      // Then
      expect(result.briefing).toBeNull();
      expect(result.report.current.temperature).toBe(12.4);
      expect(logger.messages).toContainEqual(
        expect.objectContaining({ event: "weather.report.briefing_todos_unavailable" }),
      );
    });
  });
});
