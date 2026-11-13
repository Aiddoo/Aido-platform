import { WeatherReportCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-report.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { FakeTimerClock } from "#test/doubles/platform/fake-timer-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubTimezoneResolver } from "#test/doubles/weather/stub-timezone-resolver";
import { StubWeatherReportProvider } from "#test/doubles/weather/stub-weather-report-provider";
import { weatherReportFixture } from "#test/fixtures/weather.fixture";

import { ReadWeatherReportUseCase } from "./read-weather-report.use-case.js";
import { ReadWeatherReportsUseCase } from "./read-weather-reports.use-case.js";

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
/** 서울 시청에서 수백 m 떨어진 같은 geohash5 칸 */
const SEOUL_NEARBY = { latitude: 37.5651, longitude: 126.9895 };
const TOKYO = { latitude: 35.6762, longitude: 139.6503 };

describe("ReadWeatherReportsUseCase — 여러 위치의 v2 리포트를 칸 캐시로 읽기", () => {
  const now = Temporal.Instant.from("2026-11-02T06:20:00.000Z");
  let memory: InMemoryCacheStore;
  let provider: StubWeatherReportProvider;
  let timezoneResolver: StubTimezoneResolver;
  let logger: SilentLogger;
  let reader: ReadWeatherReportsUseCase;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now.epochMilliseconds);
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    provider = new StubWeatherReportProvider();
    timezoneResolver = new StubTimezoneResolver();
    logger = new SilentLogger();
    reader = new ReadWeatherReportsUseCase({
      readWeatherReport: new ReadWeatherReportUseCase({
        weatherReportProvider: provider,
        weatherReportCache: new WeatherReportCache(memory, new FakeTimerClock()),
        logger,
      }),
      timezoneResolver,
      logger,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 칸의 사용자 여러 명은 공급자를 한 번만 부르고 모두 같은 리포트를 받는다", async () => {
    // Given 같은 칸의 50명
    const requests = Array.from({ length: 50 }, (_, index) => ({
      key: `user-${index}`,
      ...(index % 2 === 0 ? SEOUL : SEOUL_NEARBY),
      language: "ko" as const,
    }));
    // When
    const reports = await reader.execute({ requests, now });
    // Then
    expect(provider.calls).toHaveLength(1);
    expect(reports.size).toBe(50);
    expect(reports.get("user-0")?.timezone).toBe("Asia/Seoul");
  });

  it("다른 시간대 작업이 같은 칸을 동시에 읽어도 공급자는 한 번이다", async () => {
    // Given
    const first = [{ key: "a", ...SEOUL, language: "ko" as const }];
    const second = [{ key: "b", ...SEOUL_NEARBY, language: "en" as const }];
    // When
    await Promise.all([
      reader.execute({ requests: first, now }),
      reader.execute({ requests: second, now }),
    ]);
    // Then
    expect(provider.calls).toHaveLength(1);
  });

  it("칸이 다르면 칸마다 한 번씩 부르고 공급자에는 칸 중심 좌표만 보낸다", async () => {
    // Given
    const requests = [
      { key: "seoul", ...SEOUL, language: "ko" as const },
      { key: "tokyo", ...TOKYO, language: "en" as const },
    ];
    // When
    await reader.execute({ requests, now });
    // Then
    expect(provider.calls.map((call) => call.cellKey).sort()).toEqual(["wydm9", "xn76c"]);
    expect(timezoneResolver.coordinates.map((c) => c.latitude)).not.toContain(SEOUL.latitude);
  });

  it("캐시가 지나 공급자가 실패하면 마지막 리포트를, 그것도 없으면 그 키를 결과에서 뺀다", async () => {
    // Given 서울만 한 번 성공해 둔다
    await reader.execute({ requests: [{ key: "seoul", ...SEOUL, language: "ko" }], now });
    provider.failure = new Error("weatherkit 429");
    const later = Temporal.Instant.from("2026-11-02T08:00:00.000Z");
    vi.setSystemTime(later.epochMilliseconds);
    // When
    const reports = await reader.execute({
      requests: [
        { key: "seoul", ...SEOUL, language: "ko" },
        { key: "tokyo", ...TOKYO, language: "ko" },
      ],
      now: later,
    });
    // Then
    expect(reports.get("seoul")?.report.fetchedAt).toEqual(now);
    expect(reports.get("seoul")?.report.hourly[0]?.startsAt).toEqual(later);
    expect(reports.has("tokyo")).toBe(false);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ event: "weather.report.unavailable", cellKey: "xn76c" }),
    );
  });

  it("장애로 언어 판단이 실패해 공유 scope가 되어도 언어별로 받아 둔 리포트로 폴백한다", async () => {
    // Given 특보가 있는 칸이라 ko scope로 한 번 받아 두었다
    provider.hasLocalizedContent = true;
    await reader.execute({ requests: [{ key: "seoul", ...SEOUL, language: "ko" }], now });
    provider.localizationFailure = new Error("availability timeout");
    provider.failure = new Error("weatherkit 503");
    const later = Temporal.Instant.from("2026-11-02T08:00:00.000Z");
    vi.setSystemTime(later.epochMilliseconds);
    // When
    const reports = await reader.execute({
      requests: [{ key: "seoul", ...SEOUL, language: "ko" }],
      now: later,
    });
    // Then
    expect(reports.get("seoul")?.report.fetchedAt).toEqual(now);
  });

  it("요청이 없으면 공급자를 부르지 않는다", async () => {
    // When
    const reports = await reader.execute({ requests: [], now });
    // Then
    expect(reports.size).toBe(0);
    expect(provider.calls).toEqual([]);
  });

  it("응답은 읽는 시각 기준으로 지난 시간을 잘라 돌려준다", async () => {
    // Given 두 시간 전 받은 리포트가 캐시에 있다
    provider.report = weatherReportFixture(Temporal.Instant.from("2026-11-02T04:20:00.000Z"));
    // When
    const reports = await reader.execute({
      requests: [{ key: "a", ...SEOUL, language: "ko" }],
      now,
    });
    // Then
    expect(reports.get("a")?.report.hourly[0]?.startsAt).toEqual(
      Temporal.Instant.from("2026-11-02T06:00:00.000Z"),
    );
  });
});
