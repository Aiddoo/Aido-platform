import type {
  WeatherBriefing as WeatherBriefingResponse,
  WeatherDayPartForecast,
  WeatherReportResponse,
} from "@aido/api/contracts/weather";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { WeatherReportResult } from "../../../application/use-cases/get-weather-report.use-case.js";
import type { WeatherBriefing } from "../../../domain/weather-briefing.domain-service.js";
import type { WeatherReportDayPart } from "../../../domain/weather-report.vo.js";

/** v2 대기질은 한국 위치에서 에어코리아로만 채운다. */
const AIR_QUALITY_SOURCE = "AIRKOREA";

function toIsoStringOrNull(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
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
      options: options.map((option) => ({ ...option, startsAt: toIsoString(option.startsAt) })),
    })),
  };
}

/** 시각은 UTC ISO 문자열로, 일별 date는 이미 위치 시간대 달력 날짜다. */
export function toWeatherReportResponse(result: WeatherReportResult): WeatherReportResponse {
  const { location, report, airQuality, attribution, briefing } = result;
  return {
    location: { ...location },
    current: { ...report.current, observedAt: toIsoString(report.current.observedAt) },
    nextHour:
      report.nextHour == null
        ? null
        : {
            periods: report.nextHour.periods.map((period) => ({
              ...period,
              startsAt: toIsoString(period.startsAt),
              endsAt: toIsoStringOrNull(period.endsAt),
            })),
            minutes: report.nextHour.minutes.map((minute) => ({
              ...minute,
              startsAt: toIsoString(minute.startsAt),
            })),
          },
    hourly: report.hourly.map((hour) => ({ ...hour, startsAt: toIsoString(hour.startsAt) })),
    daily: report.daily.map((day) => ({
      ...day,
      date: day.date.toString(),
      sunrise: toIsoStringOrNull(day.sunrise),
      sunset: toIsoStringOrNull(day.sunset),
      moonrise: toIsoStringOrNull(day.moonrise),
      moonset: toIsoStringOrNull(day.moonset),
      restOfDay: toDayPartResponse(day.restOfDay),
      daytime: toDayPartResponse(day.daytime),
      overnight: toDayPartResponse(day.overnight),
    })),
    alerts: report.alerts.map((alert) => ({
      ...alert,
      effectiveAt: toIsoString(alert.effectiveAt),
      expiresAt: toIsoString(alert.expiresAt),
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
    fetchedAt: toIsoString(report.fetchedAt),
    briefing: briefing == null ? undefined : toBriefingResponse(briefing),
  };
}
