import {
  weatherAirQualitySchema,
  weatherAlertSchema,
  weatherAttributionSchema,
  weatherCurrentConditionsSchema,
  weatherDailyForecastSchema,
  weatherHourlyForecastSchema,
  weatherLocationSchema,
  weatherMinuteForecastSchema,
  weatherNextHourPeriodSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const currentWeatherSchema = weatherCurrentConditionsSchema.extend({
  observedAt: instantSchema,
});
export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

const minuteForecastSchema = weatherMinuteForecastSchema.extend({ startsAt: instantSchema });
export type MinuteForecast = z.infer<typeof minuteForecastSchema>;

const nextHourPeriodSchema = weatherNextHourPeriodSchema.extend({
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
});

const nextHourForecastSchema = z.object({
  periods: z.array(nextHourPeriodSchema),
  minutes: z.array(minuteForecastSchema),
});
export type NextHourForecast = z.infer<typeof nextHourForecastSchema>;

const hourlyForecastSchema = weatherHourlyForecastSchema.extend({ startsAt: instantSchema });
export type HourlyForecastEntry = z.infer<typeof hourlyForecastSchema>;

const dailyForecastSchema = weatherDailyForecastSchema.extend({
  sunrise: instantSchema.nullable(),
  sunset: instantSchema.nullable(),
  moonrise: instantSchema.nullable(),
  moonset: instantSchema.nullable(),
});
export type DailyForecastEntry = z.infer<typeof dailyForecastSchema>;

const weatherAlertModelSchema = weatherAlertSchema.extend({
  effectiveAt: instantSchema,
  expiresAt: instantSchema,
});
export type WeatherAlert = z.infer<typeof weatherAlertModelSchema>;

export type AirQuality = z.infer<typeof weatherAirQualitySchema>;

export const weatherReportModelSchema = z.object({
  location: weatherLocationSchema,
  current: currentWeatherSchema,
  nextHour: nextHourForecastSchema.nullable(),
  hourly: z.array(hourlyForecastSchema),
  daily: z.array(dailyForecastSchema),
  alerts: z.array(weatherAlertModelSchema),
  airQuality: weatherAirQualitySchema.nullable(),
  attribution: weatherAttributionSchema,
  fetchedAt: instantSchema,
});
export type WeatherReport = z.infer<typeof weatherReportModelSchema>;
export type AttributionInfo = WeatherReport['attribution'];
