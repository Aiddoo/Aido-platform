import type { WeatherLocationResponse, WeatherReportResponse } from '@aido/api';
import { type Instant, toInstant } from '@src/shared/date/instant';

import type { RegisteredLocation } from '../schemas/weather-location.schema';
import type { WeatherReport } from '../schemas/weather-report.schema';

export const toRegisteredLocation = (dto: WeatherLocationResponse): RegisteredLocation => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  timezone: dto.timezone,
});

const toNullableInstant = (value: string | null): Instant | null =>
  value == null ? null : toInstant(value);

export const toWeatherReport = (dto: WeatherReportResponse): WeatherReport => ({
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
});
