import type { WeatherBriefing, WeatherLocationResponse, WeatherReportResponse } from '@aido/api';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import type {
  RegisteredLocation,
  WeatherReport,
  WeatherReportBriefing,
} from '../domains/weather-report.model';

export function toRegisteredLocation(dto: WeatherLocationResponse): RegisteredLocation {
  return {
    latitude: dto.latitude,
    longitude: dto.longitude,
    timezone: dto.timezone,
  };
}

function toWeatherReportBriefing(dto: WeatherBriefing): WeatherReportBriefing {
  return {
    reason: dto.reason,
    affectedTodoIds: dto.affectedTodoIds,
    rescheduleOptions: dto.rescheduleOptions.map(({ todoId, options }) => ({
      todoId,
      options: options.map((option) => ({ ...option, startsAt: toInstant(option.startsAt) })),
    })),
  };
}

export function toWeatherReport(dto: WeatherReportResponse): WeatherReport {
  return {
    location: toRegisteredLocation(dto.location),
    current: { ...dto.current, observedAt: toInstant(dto.current.observedAt) },
    nextHour:
      dto.nextHour == null
        ? null
        : {
            periods: dto.nextHour.periods.map((period) => ({
              ...period,
              startsAt: toInstant(period.startsAt),
              endsAt: toNullableInstant(period.endsAt),
            })),
            minutes: dto.nextHour.minutes.map((minute) => ({
              ...minute,
              startsAt: toInstant(minute.startsAt),
            })),
          },
    hourly: dto.hourly.map((hour) => ({ ...hour, startsAt: toInstant(hour.startsAt) })),
    daily: dto.daily.map((day) => ({
      ...day,
      sunrise: toNullableInstant(day.sunrise),
      sunset: toNullableInstant(day.sunset),
      moonrise: toNullableInstant(day.moonrise),
      moonset: toNullableInstant(day.moonset),
    })),
    alerts: dto.alerts.map((alert) => ({
      ...alert,
      effectiveAt: toInstant(alert.effectiveAt),
      expiresAt: toInstant(alert.expiresAt),
    })),
    airQuality: dto.airQuality,
    attribution: dto.attribution,
    fetchedAt: toInstant(dto.fetchedAt),
    briefing: dto.briefing == null ? null : toWeatherReportBriefing(dto.briefing),
  };
}
