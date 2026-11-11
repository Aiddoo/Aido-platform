import { weatherReportFixture } from "#test/fixtures/weather.fixture";

import { windowWeatherReport } from "./weather-report-window.domain-service.js";

describe("windowWeatherReport — 응답 시각 기준 창", () => {
  it("시간별은 현재 시각이 속한 시간부터 최대 24개다", () => {
    // Given
    const report = weatherReportFixture(new Date("2026-11-02T02:10:00.000Z"));
    const now = new Date("2026-11-02T06:59:59.000Z");
    // When
    const windowed = windowWeatherReport(report, now, "Asia/Seoul");
    // Then
    expect(windowed.hourly).toHaveLength(24);
    expect(windowed.hourly[0]?.startsAt).toEqual(new Date("2026-11-02T06:00:00.000Z"));
  });

  it("일별은 위치 시간대의 오늘부터 최대 10일이다", () => {
    // Given
    const report = weatherReportFixture(new Date("2026-11-02T06:20:00.000Z"));
    const seoulNextDay = new Date("2026-11-02T15:30:00.000Z");
    // When
    const windowed = windowWeatherReport(report, seoulNextDay, "Asia/Seoul");
    // Then
    expect(windowed.daily).toHaveLength(10);
    expect(windowed.daily[0]?.date).toBe("2026-11-03");
  });

  it("같은 시각이라도 위치 시간대에 따라 오늘이 다르다", () => {
    // Given
    const report = weatherReportFixture(new Date("2026-11-02T06:20:00.000Z"));
    const now = new Date("2026-11-02T16:00:00.000Z");
    // When
    const seoul = windowWeatherReport(report, now, "Asia/Seoul");
    const losAngeles = windowWeatherReport(report, now, "America/Los_Angeles");
    // Then
    expect(seoul.daily[0]?.date).toBe("2026-11-03");
    expect(losAngeles.daily[0]?.date).toBe("2026-11-02");
  });

  it("다음 1시간은 지난 분과 끝난 구간을 버리고 남은 것이 없으면 null이다", () => {
    // Given
    const fetchedAt = new Date("2026-11-02T06:20:00.000Z");
    const report = weatherReportFixture(fetchedAt, {
      nextHour: {
        periods: [
          {
            condition: "CLEAR",
            precipitationType: "NONE",
            startsAt: fetchedAt,
            endsAt: new Date("2026-11-02T06:30:00.000Z"),
            precipitationChance: 0,
            precipitationIntensity: 0,
          },
          {
            condition: "PRECIPITATION",
            precipitationType: "RAIN",
            startsAt: new Date("2026-11-02T06:30:00.000Z"),
            endsAt: null,
            precipitationChance: 70,
            precipitationIntensity: 1.5,
          },
        ],
        minutes: Array.from({ length: 60 }, (_, index) => ({
          startsAt: new Date(fetchedAt.getTime() + index * 60_000),
          precipitationChance: 70,
          precipitationIntensity: 1.5,
        })),
      },
    });
    // When
    const later = windowWeatherReport(report, new Date("2026-11-02T06:40:00.000Z"), "Asia/Seoul");
    const expired = windowWeatherReport(
      { ...report, nextHour: report.nextHour == null ? null : { ...report.nextHour, periods: [] } },
      new Date("2026-11-02T08:00:00.000Z"),
      "Asia/Seoul",
    );
    // Then
    expect(later.nextHour?.periods.map((period) => period.condition)).toEqual(["PRECIPITATION"]);
    expect(later.nextHour?.minutes[0]?.startsAt).toEqual(new Date("2026-11-02T06:40:00.000Z"));
    expect(expired.nextHour).toBeNull();
  });
});
