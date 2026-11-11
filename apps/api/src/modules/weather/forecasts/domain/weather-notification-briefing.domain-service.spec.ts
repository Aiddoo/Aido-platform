import {
  decideEveningWeatherBriefing,
  decideMorningWeatherBriefing,
  type WeatherBriefingDay,
  type WeatherBriefingForecast,
  type WeatherBriefingReportHour,
} from "./weather-notification-briefing.domain-service.js";

const HOUR_MS = 60 * 60_000;
/** 서울 2026-07-16 07:00 */
const NOW = new Date("2026-07-15T22:00:00.000Z");
const SEOUL = { now: NOW, timezone: "Asia/Seoul", locationTimezone: "Asia/Seoul" };

function hourAt(
  kstHour: number,
  overrides: Partial<WeatherBriefingReportHour> = {},
): WeatherBriefingReportHour {
  return {
    startsAt: new Date(NOW.getTime() + (kstHour - 7) * HOUR_MS),
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
    date,
    condition: "PARTLY_CLOUDY",
    temperatureMin: 21,
    temperatureMax: 29,
    precipitationChance: 20,
    precipitationType: "RAIN",
    ...overrides,
  };
}

/** 서울 07시부터 24시간 맑음. changes의 KST 시각만 바꾼다 */
function forecast(
  changes: Record<number, Partial<WeatherBriefingReportHour>> = {},
): WeatherBriefingForecast {
  return {
    hourly: Array.from({ length: 24 }, (_, index) => hourAt(7 + index, changes[7 + index] ?? {})),
    daily: [day("2026-07-16"), day("2026-07-17")],
  };
}

function todoAt(id: number, kstHour: number, title = `할 일 ${id}`) {
  return { id, title, scheduledAt: new Date(NOW.getTime() + (kstHour - 7) * HOUR_MS) };
}

describe("날씨 브리핑 정책 — 아침", () => {
  it("할 일 시각의 강수 확률이 50% 이상이면 가장 이른 할 일로 비를 알린다", () => {
    // Given 15시·17시 할 일이 비와 겹친다
    const report = forecast({ 15: { precipitationChance: 70 }, 17: { precipitationChance: 60 } });
    // When
    const result = decideMorningWeatherBriefing(
      report,
      [todoAt(2, 17), todoAt(1, 15, "한강 산책")],
      SEOUL,
    );
    // Then
    expect(result).toEqual({
      kind: "todoWet",
      hazard: "rain",
      todo: todoAt(1, 15, "한강 산책"),
      todoIds: [1, 2],
      precipitationChance: 70,
    });
  });

  it("강수 확률 49%는 비로 보지 않는다", () => {
    // Given
    const report = forecast({ 15: { precipitationChance: 49 } });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 15)], SEOUL);
    // Then
    expect(result?.kind).toBe("summary");
  });

  it("겹친 시간 중 뇌우가 있으면 뇌우 할 일을 알린다", () => {
    // Given
    const report = forecast({
      10: { precipitationChance: 60 },
      15: { precipitationChance: 80, condition: "THUNDERSTORMS" },
    });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 10), todoAt(2, 15)], SEOUL);
    // Then
    expect(result).toMatchObject({ kind: "todoWet", hazard: "storm", todo: { id: 2 } });
  });

  it("겹친 시간이 모두 눈이면 눈으로 알린다", () => {
    // Given
    const report = forecast({ 9: { precipitationChance: 80, precipitationType: "SNOW" } });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 9)], SEOUL);
    // Then
    expect(result).toMatchObject({ kind: "todoWet", hazard: "snow" });
  });

  it("낮 체감 33°C 이상 시간과 겹치면 그 더운 시간대의 최고 체감 온도로 알린다", () => {
    // Given 13~15시 더위, 14시 할 일
    const report = forecast({
      13: { apparentTemperature: 33 },
      14: { apparentTemperature: 35.4 },
      15: { apparentTemperature: 34 },
    });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 14)], SEOUL);
    // Then
    expect(result).toEqual({
      kind: "todoHot",
      todo: todoAt(1, 14),
      todoIds: [1],
      peakApparentTemperature: 35.4,
    });
  });

  it("밤 시간의 높은 체감 온도는 더위로 보지 않는다", () => {
    // Given 22시(밤) 체감 34°C
    const report = forecast({ 22: { apparentTemperature: 34 } });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 22)], SEOUL);
    // Then
    expect(result?.kind).toBe("summary");
  });

  it("비가 더위보다 먼저다", () => {
    // Given
    const report = forecast({
      12: { apparentTemperature: 36 },
      16: { precipitationChance: 90 },
    });
    // When
    const result = decideMorningWeatherBriefing(report, [todoAt(1, 12), todoAt(2, 16)], SEOUL);
    // Then
    expect(result).toMatchObject({ kind: "todoWet", todo: { id: 2 } });
  });

  it("할 일과 겹치지 않아도 오늘 늦게 비가 오면 시작 시각을 알린다", () => {
    // Given 18시부터 비, 할 일 없음
    const report = forecast({ 18: { precipitationChance: 60 }, 19: { precipitationChance: 70 } });
    // When
    const result = decideMorningWeatherBriefing(report, [], SEOUL);
    // Then
    expect(result).toEqual({ kind: "wetLater", startsAt: hourAt(18).startsAt, isSnow: false });
  });

  it("내일 새벽 비는 오늘 비로 알리지 않는다", () => {
    // Given 서울 다음 날 02시 비
    const report = forecast({ 26: { precipitationChance: 90 } });
    // When
    const result = decideMorningWeatherBriefing(report, [], SEOUL);
    // Then
    expect(result).toEqual({ kind: "summary", day: day("2026-07-16") });
  });

  it("지난 할 일과 예보 범위 밖 할 일은 판단에서 뺀다", () => {
    // Given 06시(지난)·비 오는 시간
    const report = forecast();
    const past = { id: 1, title: "지난 일", scheduledAt: new Date(NOW.getTime() - HOUR_MS) };
    // When
    const result = decideMorningWeatherBriefing(report, [past], SEOUL);
    // Then
    expect(result?.kind).toBe("summary");
  });

  it("오늘 일별 예보가 없으면 판단하지 않는다", () => {
    // Given
    const report = { ...forecast(), daily: [day("2026-07-17")] };
    // When
    const result = decideMorningWeatherBriefing(report, [], SEOUL);
    // Then
    expect(result).toBeNull();
  });

  it("오늘·내일 구분은 알림 시간대를 따른다 (같은 순간, LA 기기)", () => {
    // Given LA 기준 2026-07-15 15:00. 서울 시각 18시(=LA 02시 다음 날)는 LA의 내일이다
    const report = forecast({ 18: { precipitationChance: 80 } });
    const clock = { now: NOW, timezone: "America/Los_Angeles", locationTimezone: "Asia/Seoul" };
    // When
    const result = decideMorningWeatherBriefing(report, [], clock);
    // Then
    expect(result?.kind).toBe("summary");
  });
});

describe("날씨 브리핑 정책 — 저녁", () => {
  /** 서울 2026-07-16 21:00 */
  const EVENING = { ...SEOUL, now: new Date("2026-07-16T12:00:00.000Z") };

  function eveningForecast(
    changes: Record<number, Partial<WeatherBriefingReportHour>> = {},
    tomorrow: Partial<WeatherBriefingDay> = {},
  ): WeatherBriefingForecast {
    // 서울 21시부터 24시간
    const startsAtMs = EVENING.now.getTime();
    return {
      hourly: Array.from({ length: 24 }, (_, index) => {
        const kstHour = 21 + index;
        return {
          ...hourAt(kstHour),
          startsAt: new Date(startsAtMs + index * HOUR_MS),
          ...changes[kstHour],
        };
      }),
      daily: [day("2026-07-16"), day("2026-07-17", tomorrow)],
    };
  }

  it("내일 비가 시작하는 시간대를 알린다", () => {
    // Given 내일 14시(서울 38시)부터 비
    const report = eveningForecast({ 38: { precipitationChance: 70 } });
    // When
    const result = decideEveningWeatherBriefing(report, EVENING);
    // Then
    expect(result).toMatchObject({ kind: "wetTomorrow", dayPart: "afternoon", isSnow: false });
  });

  it("오늘 밤 비는 내일 비로 알리지 않는다", () => {
    // Given 오늘 22시 비
    const report = eveningForecast({ 22: { precipitationChance: 90 } });
    // When
    const result = decideEveningWeatherBriefing(report, EVENING);
    // Then
    expect(result?.kind).toBe("tomorrowSummary");
  });

  it("시간별 범위 밖이라도 내일 일별 강수 확률이 50% 이상이면 시간대 없이 알린다", () => {
    // Given
    const report = eveningForecast({}, { precipitationChance: 60, precipitationType: "SNOW" });
    // When
    const result = decideEveningWeatherBriefing(report, EVENING);
    // Then
    expect(result).toMatchObject({ kind: "wetTomorrow", dayPart: null, isSnow: true });
  });

  it("내일 최저 기온이 10°C 이하면 쌀쌀하다고 표시한다", () => {
    // Given
    const report = eveningForecast({}, { temperatureMin: 10 });
    // When
    const result = decideEveningWeatherBriefing(report, EVENING);
    // Then
    expect(result).toMatchObject({ kind: "tomorrowSummary", isChilly: true });
  });

  it("내일 일별 예보가 없으면 판단하지 않는다", () => {
    // Given
    const report = { ...eveningForecast(), daily: [day("2026-07-16")] };
    // When
    const result = decideEveningWeatherBriefing(report, EVENING);
    // Then
    expect(result).toBeNull();
  });
});
