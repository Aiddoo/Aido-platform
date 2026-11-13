import { weatherReportFixture } from "#test/fixtures/weather.fixture";

const at = (text: string) => Temporal.Instant.from(text);

describe("WeatherReport.windowAt — 응답 시각 기준 창", () => {
  it("시간별은 현재 시각이 속한 시간부터 최대 24개다", () => {
    // Given
    const report = weatherReportFixture(at("2026-11-02T02:10:00.000Z"));

    // When
    const windowed = report.windowAt(at("2026-11-02T06:59:59.000Z"), "Asia/Seoul");

    // Then
    expect(windowed.hourly).toHaveLength(24);
    expect(windowed.hourly[0]?.startsAt).toEqual(at("2026-11-02T06:00:00.000Z"));
  });

  it("일별은 위치 시간대의 오늘부터 최대 10일이다", () => {
    // Given
    const report = weatherReportFixture(at("2026-11-02T06:20:00.000Z"));

    // When
    const windowed = report.windowAt(at("2026-11-02T15:30:00.000Z"), "Asia/Seoul");

    // Then
    expect(windowed.daily).toHaveLength(10);
    expect(windowed.daily[0]?.date.toString()).toBe("2026-11-03");
  });

  it("같은 시각이라도 위치 시간대에 따라 오늘이 다르다", () => {
    // Given
    const report = weatherReportFixture(at("2026-11-02T06:20:00.000Z"));
    const now = at("2026-11-02T16:00:00.000Z");

    // When
    const seoul = report.windowAt(now, "Asia/Seoul");
    const losAngeles = report.windowAt(now, "America/Los_Angeles");

    // Then
    expect(seoul.daily[0]?.date.toString()).toBe("2026-11-03");
    expect(losAngeles.daily[0]?.date.toString()).toBe("2026-11-02");
  });

  it("다음 1시간은 지난 분과 끝난 구간을 버리고 남은 것이 없으면 null이다", () => {
    // Given
    const fetchedAt = at("2026-11-02T06:20:00.000Z");
    const report = weatherReportFixture(fetchedAt, {
      nextHour: {
        periods: [
          {
            condition: "CLEAR",
            precipitationType: "NONE",
            startsAt: fetchedAt,
            endsAt: at("2026-11-02T06:30:00.000Z"),
            precipitationChance: 0,
            precipitationIntensity: 0,
          },
          {
            condition: "PRECIPITATION",
            precipitationType: "RAIN",
            startsAt: at("2026-11-02T06:30:00.000Z"),
            endsAt: null,
            precipitationChance: 70,
            precipitationIntensity: 1.5,
          },
        ],
        minutes: Array.from({ length: 60 }, (_, index) => ({
          startsAt: fetchedAt.add({ minutes: index }),
          precipitationChance: 70,
          precipitationIntensity: 1.5,
        })),
      },
    });
    const withoutPeriods = weatherReportFixture(fetchedAt, {
      nextHour: { periods: [], minutes: report.nextHour?.minutes ?? [] },
    });

    // When
    const later = report.windowAt(at("2026-11-02T06:40:00.000Z"), "Asia/Seoul");
    const expired = withoutPeriods.windowAt(at("2026-11-02T08:00:00.000Z"), "Asia/Seoul");

    // Then
    expect(later.nextHour?.periods.map((period) => period.condition)).toEqual(["PRECIPITATION"]);
    expect(later.nextHour?.minutes[0]?.startsAt).toEqual(at("2026-11-02T06:40:00.000Z"));
    expect(expired.nextHour).toBeNull();
  });
});

describe("WeatherReport.isPrecipitationSoon — 곧 비·눈이 오는지", () => {
  const now = at("2026-11-02T06:20:00.000Z");

  it("2시간 안에 강수 예보가 없으면 아니다", () => {
    // Given 강수 확률 10%인 맑은 리포트
    const report = weatherReportFixture(now);

    // When
    const soon = report.isPrecipitationSoon(now);

    // Then
    expect(soon).toBe(false);
  });

  it("지금 비가 오고 있으면 그렇다", () => {
    // Given
    const base = weatherReportFixture(now);
    const report = weatherReportFixture(now, {
      current: { ...base.current, precipitationIntensity: 0.6 },
    });

    // When
    const soon = report.isPrecipitationSoon(now);

    // Then
    expect(soon).toBe(true);
  });

  it("다음 1시간 예보에 강수 구간이 있으면 그렇다", () => {
    // Given 30분 뒤 시작하는 강수 구간
    const report = weatherReportFixture(now, {
      nextHour: {
        periods: [
          {
            condition: "PRECIPITATION",
            precipitationType: "RAIN",
            startsAt: at("2026-11-02T06:50:00.000Z"),
            endsAt: null,
            precipitationChance: 80,
            precipitationIntensity: 1.2,
          },
        ],
        minutes: [],
      },
    });

    // When
    const soon = report.isPrecipitationSoon(now);

    // Then
    expect(soon).toBe(true);
  });

  it("강수 확률 50% 이상인 시간이 2시간 뒤 밖이면 아니다", () => {
    // Given 3시간 뒤 강수 확률 90%
    const base = weatherReportFixture(now);
    const report = weatherReportFixture(now, {
      hourly: base.hourly.map((hour, index) =>
        index === 3 ? { ...hour, precipitationChance: 90 } : hour,
      ),
    });

    // When
    const soon = report.isPrecipitationSoon(now);

    // Then
    expect(soon).toBe(false);
  });
});
