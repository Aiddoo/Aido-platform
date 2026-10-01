import { PRECIPITATION_TYPES, SKY_CONDITIONS } from '@aido/validators';
import { z } from 'zod';

export const hourlyForecastSchema = z.object({
  hour: z.number().int().min(0).max(23),
  temperature: z.number(),
  skyCondition: z.enum(SKY_CONDITIONS),
  precipitationProbability: z.number().int().min(0).max(100),
  precipitationAmount: z.number().min(0),
  snowAmount: z.number().min(0),
});

export type HourlyForecast = z.infer<typeof hourlyForecastSchema>;

export const dailyForecastSchema = z.object({
  date: z.string(),
  skyCondition: z.enum(SKY_CONDITIONS),
  precipitationType: z.enum(PRECIPITATION_TYPES),
  precipitationProbability: z.number().int().min(0).max(100),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
});

export type DailyForecast = z.infer<typeof dailyForecastSchema>;

export const weatherConditionsSchema = z.object({
  feelsLikeTemperature: z.number().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  pm10: z.number().nullable(),
  pm25: z.number().nullable(),
});

export type WeatherConditions = z.infer<typeof weatherConditionsSchema>;

export const weatherForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  date: z.date(),
  skyCondition: z.enum(SKY_CONDITIONS),
  precipitationType: z.enum(PRECIPITATION_TYPES),
  precipitationProbability: z.number().int().min(0).max(100),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
  humidity: z.number().int().min(0).max(100),
  windSpeed: z.number(),
  hourlyForecasts: z.array(hourlyForecastSchema),
  dailyForecasts: z.array(dailyForecastSchema).optional().default([]),
});

export type WeatherForecast = z.infer<typeof weatherForecastSchema>;

export const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  gridX: z.number().int(),
  gridY: z.number().int(),
});

export type Location = z.infer<typeof locationSchema>;

export function shouldShowPrecipitation(forecast: WeatherForecast): boolean {
  return forecast.precipitationType !== 'NONE' && forecast.precipitationProbability >= 30;
}

export function shouldShowHourlyPrecipitation(hourly: HourlyForecast): boolean {
  return hourly.precipitationProbability >= 30;
}

export function hasHourlyForecasts(forecast: WeatherForecast): boolean {
  return forecast.hourlyForecasts.length > 0;
}

export const WeatherPolicy = {
  shouldShowPrecipitation,
  shouldShowHourlyPrecipitation,
  hasHourlyForecasts,
} as const;
