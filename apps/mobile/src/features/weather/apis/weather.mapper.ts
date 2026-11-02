import type {
  LocationResponse,
  WeatherConditions as WeatherConditionsDTO,
  WeatherForecastResponse,
  WeatherLocationResponse,
  WeatherReportResponse,
} from '@aido/api';

import type { RegisteredLocation } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import type {
  DailyForecast,
  HourlyForecast,
  Location,
  WeatherConditions,
  WeatherForecast,
} from '../domains/weather.model';

export const toHourlyForecast = (
  dto: WeatherForecastResponse['hourlyForecasts'][number],
): HourlyForecast => ({
  hour: dto.hour,
  temperature: dto.temperature,
  skyCondition: dto.skyCondition,
  precipitationProbability: dto.precipitationProbability,
  precipitationAmount: dto.precipitationAmount,
  snowAmount: dto.snowAmount,
});

export const toDailyForecast = (
  dto: WeatherForecastResponse['dailyForecasts'][number],
): DailyForecast => ({
  date: dto.date,
  skyCondition: dto.skyCondition,
  precipitationType: dto.precipitationType,
  precipitationProbability: dto.precipitationProbability,
  temperatureMin: dto.temperatureMin,
  temperatureMax: dto.temperatureMax,
});

export const toWeatherForecast = (dto: WeatherForecastResponse): WeatherForecast => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  date: new Date(dto.date),
  skyCondition: dto.skyCondition,
  precipitationType: dto.precipitationType,
  precipitationProbability: dto.precipitationProbability,
  temperatureMin: dto.temperatureMin,
  temperatureMax: dto.temperatureMax,
  humidity: dto.humidity,
  windSpeed: dto.windSpeed,
  hourlyForecasts: dto.hourlyForecasts.map(toHourlyForecast),
  dailyForecasts: dto.dailyForecasts?.map(toDailyForecast) ?? [],
});

export const toWeatherConditions = (dto: WeatherConditionsDTO): WeatherConditions => ({
  feelsLikeTemperature: dto.feelsLikeTemperature,
  sunrise: dto.sunrise,
  sunset: dto.sunset,
  pm10: dto.pm10,
  pm25: dto.pm25,
});

export const toLocation = (dto: LocationResponse): Location => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  gridX: dto.gridX,
  gridY: dto.gridY,
});

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
