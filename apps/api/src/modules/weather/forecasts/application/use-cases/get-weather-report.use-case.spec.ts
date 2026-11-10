import { ErrorCode } from "@aido/api/errors";
import { mock, type MockProxy } from "vitest-mock-extended";

import { WeatherReportReader } from "#api/modules/weather/forecasts/application/weather-report.reader";
import { WeatherKitNotConfiguredError } from "#api/modules/weather/forecasts/infrastructure/adapters/weatherkit-token.adapter";
import { WeatherReportCacheAdapter } from "#api/modules/weather/forecasts/infrastructure/cache/weather-report.cache";
import { UserLocation } from "#api/modules/weather/locations/domain/user-location.entity";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheService } from "#api/platform/cache/cache.service";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserLocationBuilder } from "#test/builders/user-location.builder";
import {
  weatherAttributionFixture,
  weatherLocationFixture,
  weatherReportFixture,
} from "#test/fixtures/weather.fixture";
import {
  StubAirQualityProvider,
  StubTimezoneResolver,
  StubWeatherLocationRepository,
  StubWeatherReportProvider,
} from "#test/mocks/ports/weather.stub";

import { GetWeatherReport } from "./get-weather-report.use-case.js";

describe("GetWeatherReport — 칸 단위 캐시·폴백과 한국 대기질", () => {
  const now = new Date("2026-11-02T06:20:00.000Z");
  let memory: InMemoryCacheStore;
  let cache: WeatherReportCacheAdapter;
  let repository: StubWeatherLocationRepository;
  let provider: StubWeatherReportProvider;
  let timezoneResolver: StubTimezoneResolver;
  let airQuality: StubAirQualityProvider;
  let logger: MockProxy<ApplicationLoggerPort>;
  let useCase: GetWeatherReport;

  /** 캐시 TTL과 응답 시각이 같은 시계를 보도록 Date만 고정·이동한다. */
  function moveClockTo(iso: string): Date {
    const instant = new Date(iso);
    vi.setSystemTime(instant);
    return instant;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    cache = new WeatherReportCacheAdapter(new CacheService(memory));
    repository = new StubWeatherLocationRepository([weatherLocationFixture()]);
    provider = new StubWeatherReportProvider();
    timezoneResolver = new StubTimezoneResolver();
    airQuality = new StubAirQualityProvider();
    logger = mock<ApplicationLoggerPort>();
    useCase = new GetWeatherReport({
      weatherLocationRepository: repository,
      weatherReportReader: new WeatherReportReader({
        weatherReportProvider: provider,
        weatherReportCache: cache,
        timezoneResolver,
        logger,
      }),
      weatherReportProvider: provider,
      weatherReportCache: cache,
      timezoneResolver,
      airQualityProvider: airQuality,
      logger,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("위치가 없으면 공급자를 부르지 않고 WEATHER_1902다", async () => {
    // Given
    repository.records.clear();
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1902 });
    expect(provider.calls).toEqual([]);
  });

  it("칸 중심 좌표의 시간대·국가로 공급자를 부르고 저장 위치의 좌표·시간대로 응답한다", async () => {
    // Given
    airQuality.result = { pm10: 32, pm25: 18 };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now });
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
    const input = { userId: "weather-user", language: "ko" as const, now };
    // When
    await Promise.all([useCase.execute(input), useCase.execute(input)]);
    // Then
    expect(provider.calls).toHaveLength(1);
  });

  it("2시간 안에 강수 예보가 없으면 30분 동안 캐시를 쓰고 그 뒤 공급자를 다시 부른다", async () => {
    // Given 맑은 리포트
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    // When
    const withinTtl = moveClockTo("2026-11-02T06:49:59.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko", now: withinTtl });
    const afterTtl = moveClockTo("2026-11-02T06:50:01.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko", now: afterTtl });
    // Then
    expect(provider.calls).toHaveLength(2);
  });

  it("2시간 안에 강수 확률 50% 이상이면 10분만 캐시를 쓴다", async () => {
    // Given 1시간 뒤 강수 확률 70%
    const rainy = weatherReportFixture(now);
    provider.report = {
      ...rainy,
      hourly: rainy.hourly.map((hour, index) =>
        index === 1 ? { ...hour, precipitationChance: 70, precipitationType: "RAIN" } : hour,
      ),
    };
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    // When
    const afterShortTtl = moveClockTo("2026-11-02T06:30:01.000Z");
    await useCase.execute({ userId: "weather-user", language: "ko", now: afterShortTtl });
    // Then
    expect(provider.calls).toHaveLength(2);
  });

  it("번역 문구가 없는 칸은 언어가 달라도 캐시를 함께 쓴다", async () => {
    // Given 특보를 제공하지 않는 칸(한국)
    provider.hasLocalizedContent = false;
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    // When
    await useCase.execute({ userId: "weather-user", language: "en", now });
    // Then
    expect(provider.calls).toHaveLength(1);
  });

  it("언어 공유 캐시를 쓰는 칸도 공급자 표기는 요청 언어를 따른다", async () => {
    // Given 특보를 제공하지 않는 칸에 한국어 요청이 먼저 캐시를 채운다
    provider.hasLocalizedContent = false;
    const korean = await useCase.execute({ userId: "weather-user", language: "ko", now });
    // When
    const english = await useCase.execute({ userId: "weather-user", language: "en", now });
    // Then
    expect(provider.calls).toHaveLength(1);
    expect(korean.attribution).toEqual(weatherAttributionFixture("ko"));
    expect(english.attribution).toEqual(weatherAttributionFixture("en"));
  });

  it("특보처럼 번역 문구가 있는 칸은 언어별로 캐시를 나눈다", async () => {
    // Given 특보를 제공하는 칸
    provider.hasLocalizedContent = true;
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    // When
    await useCase.execute({ userId: "weather-user", language: "en", now });
    // Then
    expect(provider.calls.map((call) => call.request.language)).toEqual(["ko", "en"]);
  });

  it("캐시가 지나 공급자가 실패하면 6시간 안의 마지막 스냅샷을 응답 시각 기준으로 잘라 돌려준다", async () => {
    // Given
    provider.report = weatherReportFixture(now);
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    provider.failure = new Error("weatherkit 429");
    const later = moveClockTo("2026-11-02T10:05:00.000Z");
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now: later });
    // Then
    expect(result.report.fetchedAt).toEqual(now);
    expect(result.report.hourly[0]?.startsAt).toEqual(new Date("2026-11-02T10:00:00.000Z"));
    expect(provider.calls).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith({
      event: "weather.report.fallback_used",
      cellKey: "wydm9",
      fallback: true,
      fetchedAt: now.toISOString(),
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("37.5665");
  });

  it("마지막 성공이 6시간을 넘으면 폴백 없이 WEATHER_1901이다", async () => {
    // Given
    await useCase.execute({ userId: "weather-user", language: "ko", now });
    provider.failure = new Error("weatherkit down");
    const later = moveClockTo("2026-11-02T12:20:01.000Z");
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko", now: later });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
  });

  it("공급자가 실패하고 마지막 스냅샷도 없으면 WEATHER_1901이다", async () => {
    // Given
    provider.failure = new Error("weatherkit down");
    // When
    const result = useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(logger.error).toHaveBeenCalledWith({
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
    const result = useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.WEATHER_1901 });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "weather.report.unavailable",
        errorType: "WeatherKitNotConfiguredError",
      }),
    );
  });

  it("한국 밖 위치는 대기질 공급자를 부르지 않고 airQuality가 null이다", async () => {
    // Given
    repository.records.set("weather-user", weatherLocationFixture("weather-user", "도쿄"));
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "en", now });
    // Then
    expect(airQuality.calls).toEqual([]);
    expect(result.airQuality).toBeNull();
    expect(result.location.timezone).toBe("Asia/Tokyo");
  });

  it("한국 bbox 안이라도 국가가 한국이 아니면 대기질을 부르지 않는다", async () => {
    // Given
    timezoneResolver.region = { timezone: "Asia/Tokyo", countryCode: "JP" };
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    expect(airQuality.calls).toEqual([]);
    expect(result.airQuality).toBeNull();
  });

  it("대기질 조회가 실패해도 리포트는 성공하고 airQuality만 null이다", async () => {
    // Given
    airQuality.failure = new Error("airkorea down");
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    expect(result.airQuality).toBeNull();
    expect(result.report.current.temperature).toBe(12.4);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "weather.report.air_quality_unavailable",
        cellKey: "wydm9",
      }),
    );
  });

  it("v2 이전에 저장돼 시간대가 없는 위치는 칸 시간대로 응답한다", async () => {
    // Given
    repository.records.set(
      "weather-user",
      UserLocation.reconstitute(
        UserLocationBuilder.create("weather-user").withTimezone(null).build(),
      ),
    );
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    expect(result.location.timezone).toBe("Asia/Seoul");
  });

  it("응답 시간대는 저장된 위치 시간대가 아니라 일별 date를 정한 칸 중심 시간대다", async () => {
    // Given 저장 시간대와 칸 중심 시간대가 다르다(시간대 경계 근처)
    repository.records.set(
      "weather-user",
      UserLocation.reconstitute(
        UserLocationBuilder.create("weather-user").withTimezone("Asia/Tokyo").build(),
      ),
    );
    // When
    const result = await useCase.execute({ userId: "weather-user", language: "ko", now });
    // Then
    expect(result.location.timezone).toBe("Asia/Seoul");
  });
});
