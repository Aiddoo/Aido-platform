import { weatherReportFixture } from "#test/fixtures/weather.fixture";

import {
  WEATHER_REPORT_FRESHNESS,
  weatherReportTtlMs,
} from "./weather-report-freshness.domain-service.js";

const NOW = new Date("2026-11-02T06:20:00.000Z");

describe("날씨 리포트 캐시 보관 시간", () => {
  it("2시간 안에 강수 예보가 없으면 30분이다", () => {
    // Given 강수 확률 10%인 맑은 리포트
    const report = weatherReportFixture(NOW);
    // When
    const ttl = weatherReportTtlMs(report, NOW);
    // Then
    expect(ttl).toBe(WEATHER_REPORT_FRESHNESS.CALM_TTL_MS);
  });

  it("지금 비가 오고 있으면 10분이다", () => {
    // Given
    const base = weatherReportFixture(NOW);
    const report = { ...base, current: { ...base.current, precipitationIntensity: 0.6 } };
    // When
    const ttl = weatherReportTtlMs(report, NOW);
    // Then
    expect(ttl).toBe(WEATHER_REPORT_FRESHNESS.PRECIPITATION_SOON_TTL_MS);
  });

  it("다음 1시간 예보에 강수 구간이 있으면 10분이다", () => {
    // Given 30분 뒤 시작하는 강수 구간
    const report = {
      ...weatherReportFixture(NOW),
      nextHour: {
        periods: [
          {
            condition: "PRECIPITATION" as const,
            precipitationType: "RAIN" as const,
            startsAt: new Date("2026-11-02T06:50:00.000Z"),
            endsAt: null,
            precipitationChance: 80,
            precipitationIntensity: 1.2,
          },
        ],
        minutes: [],
      },
    };
    // When
    const ttl = weatherReportTtlMs(report, NOW);
    // Then
    expect(ttl).toBe(WEATHER_REPORT_FRESHNESS.PRECIPITATION_SOON_TTL_MS);
  });

  it("강수 확률 50% 이상인 시간이 2시간 뒤 밖이면 30분이다", () => {
    // Given 3시간 뒤 강수 확률 90%
    const base = weatherReportFixture(NOW);
    const report = {
      ...base,
      hourly: base.hourly.map((hour, index) =>
        index === 3 ? { ...hour, precipitationChance: 90 } : hour,
      ),
    };
    // When
    const ttl = weatherReportTtlMs(report, NOW);
    // Then
    expect(ttl).toBe(WEATHER_REPORT_FRESHNESS.CALM_TTL_MS);
  });
});
