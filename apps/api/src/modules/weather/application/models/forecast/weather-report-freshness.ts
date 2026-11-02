import { WEATHER_BRIEFING_RULES } from "@aido/api/vocabulary";

import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";

import type { WeatherReport } from "./weather-report.model.js";

/**
 * WeatherKit 월 호출 한도를 아끼려고 평소에는 리포트를 30분 쓰고, 2시간 안에 비·눈이 예보되면 10분만 쓴다.
 * 강수가 임박했을 때만 "몇 분 뒤 비"가 바뀌므로 그때만 자주 받는다. 비 오는 시간의 기준은 앱 브리핑·날씨 알림과 같다.
 */
export const WEATHER_REPORT_FRESHNESS = {
  CALM_TTL_MS: 30 * TIME_UNIT.MS_PER_MINUTE,
  PRECIPITATION_SOON_TTL_MS: 10 * TIME_UNIT.MS_PER_MINUTE,
  PRECIPITATION_LOOKAHEAD_MS: 2 * TIME_UNIT.MS_PER_HOUR,
  PRECIPITATION_CHANCE_THRESHOLD: WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE,
} as const;

export function isPrecipitationSoon(report: WeatherReport, now: Date): boolean {
  const horizon = now.getTime() + WEATHER_REPORT_FRESHNESS.PRECIPITATION_LOOKAHEAD_MS;
  if (report.current.precipitationIntensity > 0) {
    return true;
  }
  const nextHourRain =
    report.nextHour?.periods.some(
      (period) => period.condition === "PRECIPITATION" && period.startsAt.getTime() <= horizon,
    ) ?? false;
  if (nextHourRain) {
    return true;
  }
  return report.hourly.some(
    (hour) =>
      hour.startsAt.getTime() <= horizon &&
      hour.startsAt.getTime() + TIME_UNIT.MS_PER_HOUR > now.getTime() &&
      hour.precipitationChance >= WEATHER_REPORT_FRESHNESS.PRECIPITATION_CHANCE_THRESHOLD,
  );
}

export function weatherReportTtlMs(report: WeatherReport, now: Date): number {
  return isPrecipitationSoon(report, now)
    ? WEATHER_REPORT_FRESHNESS.PRECIPITATION_SOON_TTL_MS
    : WEATHER_REPORT_FRESHNESS.CALM_TTL_MS;
}
