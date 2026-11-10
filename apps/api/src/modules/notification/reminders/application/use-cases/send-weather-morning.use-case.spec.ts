import type { ReminderWeatherReport } from "#api/modules/notification/reminders/application/ports/reminder-weather-report.reader.port";
import { WeatherReportReader } from "#api/modules/weather/forecasts/application/weather-report.reader";
import { WeatherReportCache } from "#api/modules/weather/forecasts/infrastructure/cache/weather-report.cache";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReminderWeatherReportReader } from "#test/doubles/notification/stub-reminder-weather-report.reader";
import { StubWeatherBriefingTodoReader } from "#test/doubles/notification/stub-weather-briefing-todo.reader";
import { StubWeatherReminderReader } from "#test/doubles/notification/stub-weather-reminder.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { StubTimezoneResolver } from "#test/doubles/weather/stub-timezone-resolver";
import { StubWeatherReportProvider } from "#test/doubles/weather/stub-weather-report-provider";
import { weatherReportFixture } from "#test/fixtures/weather.fixture";

import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { SendWeatherMorningUseCase } from "./send-weather-morning.use-case.js";

const HOUR_MS = 60 * 60_000;
/** 서울 2026-11-02 07:00 */
const NOW = new Date("2026-11-01T22:00:00.000Z");
const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const TOKYO = { latitude: 35.6762, longitude: 139.6503 };

const ctx = (overrides: Partial<TimezoneContext> = {}): TimezoneContext => ({
  tz: "Asia/Seoul",
  localHour: 7,
  localMinute: 0,
  dayOfWeek: 1,
  today: new Date("2026-11-02T00:00:00.000Z"),
  tomorrow: new Date("2026-11-03T00:00:00.000Z"),
  ...overrides,
});

const atKst = (hour: number) => new Date(NOW.getTime() + (hour - 7) * HOUR_MS);

/** 서울 07시 기준 맑은 리포트. 한 시각만 바꿀 수 있다 */
function seoulReport(
  change?: {
    readonly hour: number;
    readonly precipitationChance?: number;
    readonly apparentTemperature?: number;
  },
  timezone = "Asia/Seoul",
): ReminderWeatherReport {
  const report = weatherReportFixture(NOW);
  return {
    timezone,
    report: {
      daily: report.daily.map((day, index) => ({
        ...day,
        date: index === 0 ? "2026-11-02" : day.date,
      })),
      hourly: report.hourly.map((hour) =>
        change != null && hour.startsAt.getTime() === atKst(change.hour).getTime()
          ? { ...hour, ...change }
          : hour,
      ),
    },
  };
}

describe("SendWeatherMorningUseCase — 아침 날씨 알림", () => {
  let reader: StubWeatherReminderReader;
  let todoReader: StubWeatherBriefingTodoReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let weatherReports: StubReminderWeatherReportReader;
  let logger: SilentLogger;
  let strategy: SendWeatherMorningUseCase;

  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubWeatherReminderReader();
    todoReader = new StubWeatherBriefingTodoReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    weatherReports = new StubReminderWeatherReportReader();
    logger = new SilentLogger();
    strategy = new SendWeatherMorningUseCase({
      reader,
      todoReader,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      weatherReportReader: weatherReports,
      clock: new FixedClock(Temporal.Instant.fromEpochMilliseconds(NOW.getTime())),
      logger,
    });
  });

  it("대상이 없으면 날씨를 조회하지 않고 보내지 않는다", async () => {
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 0 });
    expect(weatherReports.requests).toEqual([]);
  });

  it("해외 위치 사용자도 격자 없이 좌표로 날씨 알림을 받는다", async () => {
    // Given
    reader.usersWithLocation = [{ id: "abroad", preference: { locale: "en" }, location: TOKYO }];
    weatherReports.reports.set("abroad", seoulReport(undefined, "Asia/Tokyo"));
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 1 });
    expect(weatherReports.requests[0]).toEqual([{ key: "abroad", ...TOKYO, language: "en" }]);
    expect(sent()[0]).toMatchObject({
      userId: "abroad",
      type: "WEATHER_MORNING",
      title: "Partly cloudy today, 8–16°C",
      variantId: "weather_morning_v4.weather.morning.summary.default",
    });
  });

  it("오늘 할 일이 비와 겹치면 그 할 일과 옮기기 링크를 보낸다", async () => {
    // Given 15시 '한강 산책'에 강수 확률 70%
    reader.usersWithLocation = [{ id: "u1", preference: { locale: "ko" }, location: SEOUL }];
    todoReader.todos = [{ id: 12, userId: "u1", title: "한강 산책", scheduledTime: atKst(15) }];
    weatherReports.reports.set("u1", seoulReport({ hour: 15, precipitationChance: 70 }));
    // When
    await strategy.execute(ctx());
    // Then
    expect(sent()[0]).toMatchObject({
      title: "오후 3시 ‘한강 산책’ 때 비 소식이 있어요 ☔",
      body: "강수 확률 70% · 시간 옮기기",
      action: { type: "DEEP_LINK", url: "/weather/reschedule?todoIds=12&reason=rain" },
    });
    expect(todoReader.queries[0]).toEqual({
      userIds: ["u1"],
      date: Temporal.PlainDate.from("2026-11-02"),
      timezone: "Asia/Seoul",
      from: NOW,
      until: new Date("2026-11-02T15:00:00.000Z"),
    });
  });

  it("오늘 할 일이 낮 더위와 겹치면 체감 온도와 더위 옮기기 링크를 보낸다", async () => {
    // Given
    reader.usersWithLocation = [{ id: "u1", preference: { locale: "ko" }, location: SEOUL }];
    todoReader.todos = [{ id: 7, userId: "u1", title: "테니스", scheduledTime: atKst(13) }];
    weatherReports.reports.set("u1", seoulReport({ hour: 13, apparentTemperature: 34.6 }));
    // When
    await strategy.execute(ctx());
    // Then
    expect(sent()[0]).toMatchObject({
      title: "오후 1시 ‘테니스’ 때 체감 35°C예요 ☀️",
      action: { type: "DEEP_LINK", url: "/weather/reschedule?todoIds=7&reason=heat" },
    });
  });

  it("할 일이 없고 비 소식도 없으면 v2 일별 예보로 요약하고 링크 없이 날씨 화면으로 보낸다", async () => {
    // Given
    reader.usersWithLocation = [{ id: "u1", preference: { locale: "ko" }, location: SEOUL }];
    weatherReports.reports.set("u1", seoulReport());
    // When
    await strategy.execute(ctx());
    // Then
    const [notification] = sent();
    expect(notification).toMatchObject({
      title: "오늘은 구름 조금, 8~16°C예요",
      body: "강수 확률 20%예요. 좋은 하루 보내요",
    });
    expect(notification?.action).toBeUndefined();
  });

  it("예보를 받지 못한 사용자는 틀린 날씨 대신 앱에서 확인하라는 안내를 받는다", async () => {
    // Given 리포트 없음
    reader.usersWithLocation = [{ id: "u1", preference: { locale: "ko" }, location: SEOUL }];
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent()[0]).toMatchObject({
      title: "오늘 날씨를 확인해보세요 ☀️",
      variantId: "weather_morning_v4.weather.morning.unavailable.default",
    });
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ weatherCount: 0, unavailableCount: 1, fallbackCount: 0 }),
    );
  });

  it("오늘 이미 받은 사용자와 위치가 없는 사용자로는 날씨를 조회하지 않는다", async () => {
    // Given
    reader.usersWithLocation = [{ id: "sent", preference: null, location: SEOUL }];
    reader.fallbackUsers = [{ id: "no-location", preference: null }];
    history.notified("WEATHER_MORNING", ["sent"]);
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(weatherReports.requests).toEqual([]);
    expect(todoReader.queries).toEqual([]);
    expect(result).toEqual({ sent: 1 });
    expect(sent()[0]).toMatchObject({
      userId: "no-location",
      title: "오늘 날씨를 함께 챙겨볼까요? ☀️",
    });
  });

  it("catch-up이면 그 사용자만 조회한다", async () => {
    // When
    await strategy.execute(ctx({ userId: "user-specific" }));
    // Then
    expect(reader.userParams[0]).toMatchObject({ userId: "user-specific", hour: 7, minute: 0 });
  });
});

describe("SendWeatherMorningUseCase + weather v2 리포트 — 공급자 호출 예산", () => {
  let memory: InMemoryCacheStore;
  let provider: StubWeatherReportProvider;
  let reader: StubWeatherReminderReader;
  let todoReader: StubWeatherBriefingTodoReader;
  let publisher: RecordingNotificationPublisher;
  let clock: FixedClock;
  let strategy: SendWeatherMorningUseCase;

  // 날씨 리포트 캐시(weather Context·InMemoryCacheStore)는 Date 시계로 만료를 재서 가짜 Date 시계를 함께 옮긴다
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    clock = new FixedClock(Temporal.Instant.fromEpochMilliseconds(NOW.getTime()));
    memory = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    provider = new StubWeatherReportProvider();
    provider.report = weatherReportFixture(NOW);
    reader = new StubWeatherReminderReader();
    todoReader = new StubWeatherBriefingTodoReader();
    publisher = new RecordingNotificationPublisher();
    strategy = new SendWeatherMorningUseCase({
      reader,
      todoReader,
      notificationPublisher: publisher,
      notificationHistoryReader: new StubNotificationHistoryReader(),
      weatherReportReader: new WeatherReportReader({
        weatherReportProvider: provider,
        weatherReportCache: new WeatherReportCache(
          memory,
          new FixedClock(Temporal.Instant.fromEpochMilliseconds(NOW.getTime())),
        ),
        timezoneResolver: new StubTimezoneResolver(),
        logger: new SilentLogger(),
      }),
      clock,
      logger: new SilentLogger(),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 칸의 사용자 30명에게 보내도 WeatherKit은 한 번만 부른다", async () => {
    // Given
    reader.usersWithLocation = Array.from({ length: 30 }, (_, index) => ({
      id: `user-${index}`,
      preference: { locale: index % 2 === 0 ? "ko" : "en" },
      location: SEOUL,
    }));
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 30 });
    expect(provider.calls).toHaveLength(1);
  });

  it("캐시가 지난 뒤 공급자가 실패하면 마지막 스냅샷으로, 그것도 없으면 안내 알림으로 보낸다", async () => {
    // Given 서울은 7시에 한 번 받아 두고, 9시에 공급자 장애
    reader.usersWithLocation = [{ id: "seoul", preference: null, location: SEOUL }];
    await strategy.execute(ctx());
    const later = new Date(NOW.getTime() + 2 * HOUR_MS);
    vi.setSystemTime(later);
    clock.advanceBy({ hours: 2 });
    provider.failure = new Error("weatherkit 503");
    reader.usersWithLocation = [
      { id: "seoul", preference: null, location: SEOUL },
      { id: "tokyo", preference: null, location: TOKYO },
    ];
    publisher.published.splice(0);
    // When
    await strategy.execute(ctx({ localHour: 9 }));
    // Then
    const titles = new Map(publisher.published.map(({ data }) => [data.userId, data.title]));
    expect(titles.get("seoul")).toBe("오늘은 구름 조금, 8~16°C예요");
    expect(titles.get("tokyo")).toBe("오늘 날씨를 확인해보세요 ☀️");
  });

  it("알림 대상이 아니면 WeatherKit을 부르지 않는다", async () => {
    // Given 위치 없는 사용자만
    reader.fallbackUsers = [{ id: "no-location", preference: null }];
    // When
    await strategy.execute(ctx());
    // Then
    expect(provider.calls).toEqual([]);
  });
});
