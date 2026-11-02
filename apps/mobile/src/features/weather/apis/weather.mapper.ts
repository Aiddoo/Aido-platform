import type { WeatherLocationResponse, WeatherReportResponse } from '@aido/api';

import type { RegisteredLocation } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';

export const toRegisteredLocation = (dto: WeatherLocationResponse): RegisteredLocation => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  timezone: dto.timezone,
});

const toNullableDate = (value: string | null): Date | null =>
  value == null ? null : new Date(value);

export const toWeatherReport = (dto: WeatherReportResponse): WeatherReport => ({
  location: toRegisteredLocation(dto.location),
  current: { ...dto.current, observedAt: new Date(dto.current.observedAt) },
  nextHour:
    dto.nextHour == null
      ? null
      : {
          periods: dto.nextHour.periods.map((period) => ({
            ...period,
            startsAt: new Date(period.startsAt),
            endsAt: toNullableDate(period.endsAt),
          })),
          minutes: dto.nextHour.minutes.map((minute) => ({
            ...minute,
            startsAt: new Date(minute.startsAt),
          })),
        },
  hourly: dto.hourly.map((hour) => ({ ...hour, startsAt: new Date(hour.startsAt) })),
  daily: dto.daily.map((day) => ({
    ...day,
    sunrise: toNullableDate(day.sunrise),
    sunset: toNullableDate(day.sunset),
    moonrise: toNullableDate(day.moonrise),
    moonset: toNullableDate(day.moonset),
  })),
  alerts: dto.alerts.map((alert) => ({
    ...alert,
    effectiveAt: new Date(alert.effectiveAt),
    expiresAt: new Date(alert.expiresAt),
  })),
  airQuality: dto.airQuality,
  attribution: dto.attribution,
  fetchedAt: new Date(dto.fetchedAt),
});
