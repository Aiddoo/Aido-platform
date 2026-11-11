import { WEATHER_REPORT_LIMITS } from "@aido/api/vocabulary";

import { localDateAt } from "../../shared/domain/weather-calendar.domain-service.js";
import type { WeatherReport, WeatherReportNextHour } from "./weather-report.vo.js";

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;

/**
 * 캐시·폴백 스냅샷은 받은 시점의 창을 담고 있으므로 응답 시각 기준으로 지난 구간을 잘라낸다.
 * 시간별은 현재 시각이 속한 시간부터, 일별은 위치 시간대의 오늘부터 시작한다.
 */
export function windowWeatherReport(
  report: WeatherReport,
  now: Date,
  timezone: string,
): WeatherReport {
  const currentHourStartMs = now.getTime() - HOUR_MS;
  const today = localDateAt(now, timezone).toString();

  return {
    ...report,
    nextHour: windowNextHour(report.nextHour, now),
    hourly: report.hourly
      .filter((hour) => hour.startsAt.getTime() > currentHourStartMs)
      .slice(0, WEATHER_REPORT_LIMITS.HOURLY_FORECAST_HOURS),
    daily: report.daily
      .filter((day) => day.date >= today)
      .slice(0, WEATHER_REPORT_LIMITS.DAILY_FORECAST_DAYS),
  };
}

function windowNextHour(
  nextHour: WeatherReportNextHour | null,
  now: Date,
): WeatherReportNextHour | null {
  if (nextHour == null) {
    return null;
  }
  const currentMinuteStartMs = now.getTime() - MINUTE_MS;
  const minutes = nextHour.minutes.filter(
    (minute) => minute.startsAt.getTime() > currentMinuteStartMs,
  );
  const periods = nextHour.periods.filter(
    (period) => period.endsAt == null || period.endsAt.getTime() > now.getTime(),
  );
  if (minutes.length === 0 && periods.length === 0) {
    return null;
  }
  return { periods, minutes };
}
