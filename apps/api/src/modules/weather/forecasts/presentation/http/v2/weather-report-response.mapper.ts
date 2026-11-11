import type {
  WeatherBriefing as WeatherBriefingResponse,
  WeatherDayPartForecast,
  WeatherReportResponse,
} from "@aido/api/contracts/weather";

import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

import type { WeatherReportResult } from "../../../application/use-cases/get-weather-report.use-case.js";
import type { WeatherBriefing } from "../../../domain/weather-briefing.domain-service.js";
import type { WeatherReportDayPart } from "../../../domain/weather-report.vo.js";

/** v2 대기질은 한국 위치에서 에어코리아로만 채운다. */
const AIR_QUALITY_SOURCE = "AIRKOREA";

function toISOString(date: Date): string {
  return toIsoString(instantFromDate(date));
}

function toISOStringOrNull(date: Date | null): string | null {
  return date == null ? null : toISOString(date);
}

function toDayPartResponse(part: WeatherReportDayPart | null): WeatherDayPartForecast | null {
  return part == null ? null : { ...part };
}

function toBriefingResponse(briefing: WeatherBriefing): WeatherBriefingResponse {
  return {
    reason: briefing.reason,
    affectedTodoIds: [...briefing.affectedTodoIds],
    rescheduleOptions: briefing.rescheduleOptions.map(({ todoId, options }) => ({
      todoId,
      options: options.map((option) => ({ ...option, startsAt: toISOString(option.startsAt) })),
    })),
  };
}

/** 시각은 UTC ISO 문자열로, 일별 date는 이미 위치 시간대 달력 날짜다. */
export function toWeatherReportResponse(result: WeatherReportResult): WeatherReportResponse {
  const { location, report, airQuality, attribution, briefing } = result;
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
    airQuality:
      airQuality == null
        ? null
        : { pm10: airQuality.pm10, pm25: airQuality.pm25, source: AIR_QUALITY_SOURCE },
    attribution: {
      ...attribution,
      logo:
        attribution.logo == null
          ? null
          : {
              light: { ...attribution.logo.light },
              dark: { ...attribution.logo.dark },
            },
    },
    fetchedAt: toISOString(report.fetchedAt),
    briefing: briefing == null ? undefined : toBriefingResponse(briefing),
  };
}
