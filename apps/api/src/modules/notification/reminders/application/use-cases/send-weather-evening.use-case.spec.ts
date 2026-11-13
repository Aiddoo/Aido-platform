import type { ReminderWeatherReport } from "#api/modules/notification/reminders/application/ports/reminder-weather-report.reader.port";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReminderWeatherReportReader } from "#test/doubles/notification/stub-reminder-weather-report.reader";
import { StubWeatherReminderReader } from "#test/doubles/notification/stub-weather-reminder.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { weatherReportFixture } from "#test/fixtures/weather.fixture";

import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { SendWeatherEveningUseCase } from "./send-weather-evening.use-case.js";

const HOUR_MS = 60 * 60_000;
/** 서울 2026-11-02 20:00 */
const NOW = new Date("2026-11-02T11:00:00.000Z");
const TOKYO = { latitude: 35.6762, longitude: 139.6503 };

const ctx = (overrides: Partial<TimezoneContext> = {}): TimezoneContext => ({
  timezones: ["Asia/Seoul"],
  localHour: 20,
  localMinute: 0,
  dayOfWeek: 1,
  today: Temporal.PlainDate.from("2026-11-02"),
  tomorrow: Temporal.PlainDate.from("2026-11-03"),
  ...overrides,
});

/** 서울 20시부터 30시간. 내일(11-03) 최저 기온과 한 시각의 강수 확률을 바꿀 수 있다 */
function report({
  wetKstHourTomorrow,
  temperatureMin = 12,
}: { wetKstHourTomorrow?: number; temperatureMin?: number } = {}): ReminderWeatherReport {
  const fixture = weatherReportFixture(NOW);
  const wetAt =
    wetKstHourTomorrow == null ? null : NOW.getTime() + (wetKstHourTomorrow + 4) * HOUR_MS;
  return {
    timezone: "Asia/Seoul",
    report: {
      hourly: fixture.hourly.map((hour) =>
        hour.startsAt.getTime() === wetAt ? { ...hour, precipitationChance: 80 } : hour,
      ),
      daily: fixture.daily.map((day) =>
        day.date === "2026-11-03" ? { ...day, temperatureMin } : day,
      ),
    },
  };
}

describe("SendWeatherEveningUseCase — 저녁 날씨 알림", () => {
  let reader: StubWeatherReminderReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let weatherReports: StubReminderWeatherReportReader;
  let strategy: SendWeatherEveningUseCase;

  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubWeatherReminderReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    weatherReports = new StubReminderWeatherReportReader();
    strategy = new SendWeatherEveningUseCase({
      reader,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      weatherReportReader: weatherReports,
      clock: new FixedClock(Temporal.Instant.fromEpochMilliseconds(NOW.getTime())),
      logger: new SilentLogger(),
    });
  });

  it("내일 비가 시작하는 때와 쌀쌀함을 알린다", async () => {
    // Given 내일 서울 10시 비, 최저 6°C
    reader.usersWithLocation = [
      { id: "u1", timezone: "Asia/Seoul", preference: null, location: TOKYO },
    ];
    weatherReports.reports.set("u1", report({ wetKstHourTomorrow: 10, temperatureMin: 6 }));
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent()[0]).toMatchObject({
      type: "WEATHER_EVENING",
      title: "내일 오전부터 비 소식이 있어요 ☔",
      body: "아침엔 6°C로 쌀쌀해요. 우산과 겉옷을 챙겨주세요",
      variantId: "weather_evening_v4.weather.evening.rain.default",
    });
  });

  it("비 소식이 없으면 내일 요약을 보낸다", async () => {
    // Given
    reader.usersWithLocation = [
      { id: "u1", timezone: "Asia/Seoul", preference: { locale: "en" }, location: TOKYO },
    ];
    weatherReports.reports.set("u1", report());
    // When
    await strategy.execute(ctx());
    // Then
    expect(sent()[0]?.title).toBe("Partly cloudy tomorrow, 12–16°C 🌙");
  });

  it("예보를 받지 못하면 안내 알림을 보낸다", async () => {
    // Given
    reader.usersWithLocation = [
      { id: "u1", timezone: "Asia/Seoul", preference: null, location: TOKYO },
    ];
    // When
    await strategy.execute(ctx());
    // Then
    expect(sent()[0]?.title).toBe("내일 날씨를 미리 확인해보세요 🌙");
  });

  it("오늘 이미 받은 사용자로는 날씨를 조회하지 않는다", async () => {
    // Given
    reader.usersWithLocation = [
      { id: "u1", timezone: "Asia/Seoul", preference: null, location: TOKYO },
    ];
    history.notified("WEATHER_EVENING", ["u1"]);
    // When
    const result = await strategy.execute(ctx());
    // Then
    expect(result).toEqual({ sent: 0 });
    expect(weatherReports.requests).toEqual([]);
  });

  it("위치가 없는 사용자는 위치 설정 안내를 받는다", async () => {
    // Given
    reader.fallbackUsers = [{ id: "u1", preference: null }];
    // When
    await strategy.execute(ctx());
    // Then
    expect(weatherReports.requests).toEqual([]);
    expect(sent()[0]?.title).toBe("내일 날씨도 미리 챙겨보세요 🌙");
  });
});
