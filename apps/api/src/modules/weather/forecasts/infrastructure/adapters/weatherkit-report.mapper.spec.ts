import { weatherReportSchema } from "@aido/api";

import { weatherAttributionFixture } from "#test/fixtures/weather.fixture";
import { WeatherKitReportFixture } from "#test/fixtures/weatherkit-report.fixture";

import { toWeatherReport } from "./weatherkit-report.mapper.js";
import { weatherKitWeatherSchema } from "./weatherkit.wire.js";

const FETCHED_AT = new Date(WeatherKitReportFixture.fetchedAt);

function mapFixture(body: unknown, timezone: string) {
  const weather = weatherKitWeatherSchema.parse(body);
  const { currentWeather } = weather;
  if (currentWeather == null) {
    throw new Error("fixture에 currentWeather가 없습니다.");
  }
  return toWeatherReport({ ...weather, currentWeather }, timezone, FETCHED_AT);
}

describe("WeatherKit → 공급자 중립 리포트 매핑", () => {
  it("서울 비 응답을 m/s·0~100 정수·hPa로 정규화한다", () => {
    // Given
    const body = WeatherKitReportFixture.seoulRain();
    // When
    const report = mapFixture(body, "Asia/Seoul");
    // Then
    expect(report.current).toEqual({
      observedAt: new Date("2026-11-02T06:20:00Z"),
      condition: "RAIN",
      isDaylight: true,
      temperature: 12.4,
      apparentTemperature: 9.1,
      dewPoint: 10.5,
      humidity: 88,
      cloudCover: 98,
      uvIndex: 1,
      windSpeed: 4.6,
      windGust: 9.2,
      windDirection: 315,
      visibility: 8000,
      pressure: 1012.3,
      pressureTrend: "FALLING",
      precipitationIntensity: 1.2,
    });
    expect(report.fetchedAt).toEqual(FETCHED_AT);
  });

  it("한국처럼 분 단위 예보·특보 dataset이 없으면 nextHour는 null, alerts는 빈 배열이다", () => {
    // Given
    const body = WeatherKitReportFixture.seoulRain();
    // When
    const report = mapFixture(body, "Asia/Seoul");
    // Then
    expect(report.nextHour).toBeNull();
    expect(report.alerts).toEqual([]);
  });

  it("다음 1시간 summary를 periods로, minutes를 1분 간격으로 옮긴다", () => {
    // Given
    const body = WeatherKitReportFixture.newYorkStorm();
    // When
    const { nextHour } = mapFixture(body, "America/New_York");
    // Then
    expect(nextHour?.periods).toEqual([
      {
        condition: "CLEAR",
        precipitationType: "NONE",
        startsAt: new Date("2026-11-02T06:20:00Z"),
        endsAt: new Date("2026-11-02T06:43:00Z"),
        precipitationChance: 0,
        precipitationIntensity: 0,
      },
      {
        condition: "PRECIPITATION",
        precipitationType: "RAIN",
        startsAt: new Date("2026-11-02T06:43:00Z"),
        endsAt: null,
        precipitationChance: 80,
        precipitationIntensity: 2.4,
      },
    ]);
    expect(nextHour?.minutes).toHaveLength(60);
    expect(nextHour?.minutes[0]).toEqual({
      startsAt: new Date("2026-11-02T06:20:00Z"),
      precipitationChance: 20,
      precipitationIntensity: 0,
    });
  });

  it("형태 없이 강수로만 온 구간은 precipitationType을 비로 단정하지 않고 null로 둔다", () => {
    // Given
    const storm = WeatherKitReportFixture.newYorkStorm();
    const body = {
      ...storm,
      forecastNextHour: {
        ...storm.forecastNextHour,
        summary: [
          {
            startTime: "2026-11-02T06:20:00Z",
            condition: "precipitation",
            precipitationChance: 0.5,
            precipitationIntensity: 0.4,
          },
        ],
      },
    };
    // When
    const { nextHour } = mapFixture(body, "America/New_York");
    // Then
    expect(nextHour?.periods[0]).toMatchObject({
      condition: "PRECIPITATION",
      precipitationType: null,
    });
  });

  it("특보를 심각도 높은 순으로 정렬하고 description을 제목으로 쓴다", () => {
    // Given
    const body = WeatherKitReportFixture.newYorkStorm();
    // When
    const report = mapFixture(body, "America/New_York");
    // Then
    expect(
      report.alerts.map((alert) => [alert.id, alert.severity, alert.title, alert.areaName]),
    ).toEqual([
      ["alert-severe", "SEVERE", "Flash Flood Warning", null],
      ["alert-minor", "MINOR", "Air Quality Alert", "New York (Manhattan)"],
    ]);
    expect(report.daily[0]?.date).toBe("2026-11-02");
  });

  it("일별 date는 위치 시간대의 달력 날짜이고 풍향 360도는 0도다", () => {
    // Given
    const body = WeatherKitReportFixture.seoulRain();
    // When
    const report = mapFixture(body, "Asia/Seoul");
    // Then
    expect(report.daily.map((day) => day.date).slice(0, 2)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(report.daily[0]?.windSpeedMax).toBe(6.1);
    expect(report.daily[0]?.windGustMax).toBe(11.4);
    expect(report.daily[0]?.daytime?.temperatureMax).toBe(14);
    expect(report.hourly[0]?.windDirection).toBe(0);
    expect(report.hourly[0]?.windSpeed).toBe(5);
  });

  it("도쿄 응답은 분 단위 예보가 없으면 nextHour가 null이고 특보는 빈 배열이다", () => {
    // Given
    const body = WeatherKitReportFixture.tokyoClear();
    // When
    const report = mapFixture(body, "Asia/Tokyo");
    // Then
    expect(report.nextHour).toBeNull();
    expect(report.alerts).toEqual([]);
    expect(report.current.condition).toBe("CLEAR");
    expect(report.current.pressureTrend).toBe("RISING");
  });

  it("하노이처럼 dataset이 빠진 지역도 남은 dataset으로 리포트를 만든다", () => {
    // Given
    const body = WeatherKitReportFixture.hanoiWithoutNextHour();
    // When
    const report = mapFixture(body, "Asia/Bangkok");
    // Then
    expect(report.nextHour).toBeNull();
    expect(report.alerts).toEqual([]);
    expect(report.current.condition).toBe("HAZY");
    expect(report.daily[0]?.date).toBe("2026-11-02");
  });

  it("극야의 일출·일몰과 선택 필드가 없으면 0이 아닌 null로 둔다", () => {
    // Given
    const body = WeatherKitReportFixture.polarNight();
    // When
    const report = mapFixture(body, "Europe/Oslo");
    // Then
    const [day] = report.daily;
    expect(day?.sunrise).toBeNull();
    expect(day?.sunset).toBeNull();
    expect(day?.windSpeedMax).toBeNull();
    expect(day?.windGustMax).toBeNull();
    expect(day?.daytime?.temperatureMax).toBeNull();
    expect(day?.overnight).toBeNull();
    expect(day?.snowfallAmount).toBe(12);
    expect(day?.moonPhase).toBe("FULL");
    expect(report.current.windGust).toBeNull();
    expect(report.current.windDirection).toBeNull();
    expect(report.hourly[0]?.windDirection).toBeNull();
  });

  it("모르는 enum 값은 실패하지 않고 안전한 기본값으로 바꾼다", () => {
    // Given
    const body = WeatherKitReportFixture.unknownConditionCode();
    // When
    const report = mapFixture(body, "Asia/Seoul");
    // Then
    expect(report.current.condition).toBe("CLOUDY");
    expect(report.current.pressureTrend).toBe("STEADY");
    expect(report.hourly[0]?.condition).toBe("CLOUDY");
    expect(report.hourly[0]?.precipitationType).toBe("NONE");
    expect(report.daily[0]?.moonPhase).toBe("NEW");
    expect(report.alerts[0]?.severity).toBe("UNKNOWN");
  });

  it("매핑 결과는 날짜를 ISO로 바꾸면 공유 응답 계약을 통과하고 undefined가 없다", () => {
    // Given
    const report = mapFixture(WeatherKitReportFixture.polarNight(), "Europe/Oslo");
    // When
    const json: unknown = JSON.parse(
      JSON.stringify({
        ...report,
        hourly: report.hourly.slice(0, 24),
        daily: report.daily.slice(0, 10),
        location: { latitude: 69.65, longitude: 18.96, timezone: "Europe/Oslo" },
        airQuality: null,
        attribution: weatherAttributionFixture(),
      }),
    );
    // Then
    expect(weatherReportSchema.safeParse(json).success).toBe(true);
    expect(Object.values(report.current)).not.toContain(undefined);
  });
});
