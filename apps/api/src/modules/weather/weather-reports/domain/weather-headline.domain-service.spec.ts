import { decideWeatherHeadline } from "./weather-headline.domain-service.js";
import {
  decideMorningWeatherBriefing,
  type WeatherBriefingDay,
  type WeatherBriefingForecast,
  type WeatherBriefingReportHour,
} from "./weather-notification-briefing.domain-service.js";

/** 서울 2026-07-16 07:00 */
const NOW = Temporal.Instant.from("2026-07-15T22:00:00.000Z");
const SEOUL = { now: NOW, timezone: "Asia/Seoul", locationTimezone: "Asia/Seoul" };

function hourAt(
  kstHour: number,
  overrides: Partial<WeatherBriefingReportHour> = {},
): WeatherBriefingReportHour {
  return {
    startsAt: NOW.add({ hours: kstHour - 7 }),
    condition: "CLEAR",
    isDaylight: kstHour >= 6 && kstHour < 20,
    apparentTemperature: 25,
    precipitationChance: 10,
    precipitationType: "NONE",
    ...overrides,
  };
}

function day(date: string, overrides: Partial<WeatherBriefingDay> = {}): WeatherBriefingDay {
  return {
    date: Temporal.PlainDate.from(date),
    condition: "PARTLY_CLOUDY",
    temperatureMin: 21,
    temperatureMax: 29,
    precipitationChance: 20,
    precipitationType: "RAIN",
    ...overrides,
  };
}

/** 서울 firstHour시부터 24시간 맑음. changes의 KST 시각만 바꾼다 */
function forecast(
  changes: Record<number, Partial<WeatherBriefingReportHour>> = {},
  firstHour = 7,
): WeatherBriefingForecast {
  return {
    hourly: Array.from({ length: 24 }, (_, index) =>
      hourAt(firstHour + index, changes[firstHour + index] ?? {}),
    ),
    daily: [day("2026-07-16"), day("2026-07-17")],
  };
}

function todoAt(id: number, kstHour: number) {
  return { id, title: `할 일 ${id}`, scheduledAt: NOW.add({ hours: kstHour - 7 }) };
}

function windowOf(firstKstHour: number, lastKstHour: number) {
  return { startsAt: hourAt(firstKstHour).startsAt, endsAt: hourAt(lastKstHour + 1).startsAt };
}

describe("날씨 화면 머리글", () => {
  it("지금 시간에 이미 비가 오고 할 일과 겹치지 않으면 아침 알림처럼 오늘 비를 지금부터 알린다", () => {
    // Given
    // 07:20, 07시 강수 확률 60%
    const clock = { ...SEOUL, now: NOW.add({ minutes: 20 }) };
    const report = forecast({ 7: { precipitationChance: 60 } });
    const todos = [todoAt(1, 15)];
    // When
    const headline = decideWeatherHeadline(report, todos, clock);
    const push = decideMorningWeatherBriefing(report, todos, clock);
    // Then
    expect(headline).toEqual({ kind: "wetLater", startsAt: clock.now, isSnow: false });
    expect(push).toEqual(headline);
  });

  it("뇌우와 겹친 할 일은 뇌우가 이어지는 시간을 함께 싣는다", () => {
    // Given
    const report = forecast({
      14: { precipitationChance: 80, condition: "THUNDERSTORMS" },
      15: { precipitationChance: 80, condition: "THUNDERSTORMS" },
      16: { precipitationChance: 70 },
    });
    // When
    const headline = decideWeatherHeadline(report, [todoAt(1, 15)], SEOUL);
    // Then
    expect(headline).toEqual({
      kind: "todoWet",
      hazard: "storm",
      precipitationChance: 80,
      window: windowOf(14, 15),
    });
  });

  it("더위와 겹친 할 일은 더운 시간과 그 시간의 최고 체감 온도를 싣는다", () => {
    // Given
    const report = forecast({
      13: { apparentTemperature: 33 },
      14: { apparentTemperature: 35.4 },
      15: { apparentTemperature: 34 },
    });
    // When
    const headline = decideWeatherHeadline(report, [todoAt(1, 14)], SEOUL);
    // Then
    expect(headline).toEqual({
      kind: "todoHot",
      peakApparentTemperature: 35.4,
      window: windowOf(13, 15),
    });
  });

  it("오늘 비가 없고 내일 비가 오면 저녁 알림처럼 내일 비가 시작하는 때를 알린다", () => {
    // Given
    // 서울 다음 날 03시 비
    const report = forecast({ 27: { precipitationChance: 90, precipitationType: "SNOW" } });
    // When
    const headline = decideWeatherHeadline(report, [], SEOUL);
    // Then
    expect(headline).toEqual({ kind: "wetTomorrow", dayPart: "dawn", isSnow: true });
  });

  it("오늘 남은 낮이 맑고 덥지 않으면 가장 따뜻한 시간을 추천한다", () => {
    // Given
    const report = forecast({ 14: { apparentTemperature: 28 }, 15: { apparentTemperature: 27.5 } });
    // When
    const headline = decideWeatherHeadline(report, [], SEOUL);
    // Then
    expect(headline).toEqual({ kind: "clear", window: windowOf(14, 15) });
  });

  it("오늘 남은 낮에 흐린 시간이 있으면 맑은 날로 보지 않고 알릴 날씨가 없다", () => {
    // Given
    const report = forecast({ 12: { condition: "CLOUDY" } });
    // When
    const headline = decideWeatherHeadline(report, [todoAt(1, 12)], SEOUL);
    // Then
    expect(headline).toEqual({ kind: "calm" });
  });

  it("저녁에 오늘 남은 할 일이 없으면 내일 기온을 알리고, 남은 할 일이 있으면 알리지 않는다", () => {
    // Given
    // 서울 21:00. 낮 시간이 지나 맑은 날 추천이 없다
    const evening = { ...SEOUL, now: NOW.add({ hours: 14 }) };
    const report = forecast({}, 21);
    // When
    const withoutTodos = decideWeatherHeadline(report, [], evening);
    const withTodos = decideWeatherHeadline(report, [todoAt(1, 22)], evening);
    // Then
    expect(withoutTodos).toEqual({
      kind: "tomorrow",
      temperatureMin: 21,
      temperatureMax: 29,
      isChilly: false,
    });
    expect(withTodos).toEqual({ kind: "calm" });
  });

  it("위치 시간대의 오늘 일별 예보가 없으면 판단하지 않는다", () => {
    // Given
    const report = { ...forecast(), daily: [day("2026-07-17")] };
    // When
    const headline = decideWeatherHeadline(report, [], SEOUL);
    // Then
    expect(headline).toBeNull();
  });
});
