import type { WeatherDayPartForecast, WeatherReportResponse } from "@aido/api";

import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { WeatherReportDayPart } from "../../../../application/models/forecast/weather-report.model.js";
import type { WeatherReportResult } from "../../../../application/use-cases/forecast/get-weather-report.use-case.js";

function toDayPartResponse(part: WeatherReportDayPart | null): WeatherDayPartForecast | null {
  return part == null ? null : { ...part };
}

/** 시각은 UTC ISO 문자열로, 일별 date는 이미 위치 시간대 달력 날짜다. */
export function toWeatherReportResponse(result: WeatherReportResult): WeatherReportResponse {
  const { location, report, airQuality } = result;
  return {
    location: { ...location },
    current: { ...report.current, observedAt: toISOString(report.current.observedAt) },
    nextHour:
      report.nextHour == null
        ? null
        : {
            periods: report.nextHour.periods.map((period) => ({
              ...period,
              startsAt: toISOString(period.startsAt),
              endsAt: toISOStringOrNull(period.endsAt),
            })),
            minutes: report.nextHour.minutes.map((minute) => ({
              ...minute,
              startsAt: toISOString(minute.startsAt),
            })),
          },
    hourly: report.hourly.map((hour) => ({ ...hour, startsAt: toISOString(hour.startsAt) })),
    daily: report.daily.map((day) => ({
      ...day,
      sunrise: toISOStringOrNull(day.sunrise),
      sunset: toISOStringOrNull(day.sunset),
      moonrise: toISOStringOrNull(day.moonrise),
      moonset: toISOStringOrNull(day.moonset),
      restOfDay: toDayPartResponse(day.restOfDay),
      daytime: toDayPartResponse(day.daytime),
      overnight: toDayPartResponse(day.overnight),
    })),
    alerts: report.alerts.map((alert) => ({
      ...alert,
      effectiveAt: toISOString(alert.effectiveAt),
      expiresAt: toISOString(alert.expiresAt),
    })),
    airQuality: airQuality == null ? null : { pm10: airQuality.pm10, pm25: airQuality.pm25 },
    attribution: { ...report.attribution },
    fetchedAt: toISOString(report.fetchedAt),
  };
}
