import { PRECIPITATION_TYPES, SKY_CONDITIONS } from '@aido/api';
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

const PRECIPITATION_VISIBLE_PROBABILITY = 30;
const FORECAST_BOUNDS = { minLatitude: 33, maxLatitude: 39, minLongitude: 124, maxLongitude: 132 };
const RELOCATION_COORDINATE_DELTA = 0.01;
const PM10_GRADE_THRESHOLDS = [30, 80, 150] as const;
const PM25_GRADE_THRESHOLDS = [15, 35, 75] as const;
const TEMPERATURE_TONE_THRESHOLDS = [
  [35, 'scorching'],
  [30, 'hot'],
  [25, 'warm'],
  [20, 'mild'],
  [15, 'fresh'],
  [10, 'cool'],
  [5, 'chilly'],
] as const;

export type DustGrade = 'good' | 'normal' | 'bad' | 'veryBad';
export type TemperatureTone = (typeof TEMPERATURE_TONE_THRESHOLDS)[number][1] | 'cold';

const weatherLocationInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  countryCode: z.string().nullable(),
});
type WeatherLocationInput = z.infer<typeof weatherLocationInputSchema>;
type Coordinates = Pick<WeatherLocationInput, 'latitude' | 'longitude'>;

export function shouldShowPrecipitation(forecast: WeatherForecast): boolean {
  return (
    forecast.precipitationType !== 'NONE' &&
    forecast.precipitationProbability >= PRECIPITATION_VISIBLE_PROBABILITY
  );
}

export function shouldShowHourlyPrecipitation(hourly: HourlyForecast): boolean {
  return hourly.precipitationProbability >= PRECIPITATION_VISIBLE_PROBABILITY;
}

export function hasHourlyForecasts(forecast: WeatherForecast): boolean {
  return forecast.hourlyForecasts.length > 0;
}

export function isWithinSupportedBounds({ latitude, longitude }: Coordinates): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= FORECAST_BOUNDS.minLatitude &&
    latitude <= FORECAST_BOUNDS.maxLatitude &&
    longitude >= FORECAST_BOUNDS.minLongitude &&
    longitude <= FORECAST_BOUNDS.maxLongitude
  );
}

export function isRelocationNeeded(location: Coordinates, previous: Coordinates): boolean {
  return (
    Math.abs(location.latitude - previous.latitude) >= RELOCATION_COORDINATE_DELTA ||
    Math.abs(location.longitude - previous.longitude) >= RELOCATION_COORDINATE_DELTA
  );
}

export function isSupportedLocation(location: WeatherLocationInput): boolean {
  return location.countryCode?.toUpperCase() === 'KR' && isWithinSupportedBounds(location);
}

export function calculateDustGrade(
  value: number,
  [good, normal, bad]: readonly [number, number, number],
): DustGrade {
  if (value <= good) {
    return 'good';
  }
  if (value <= normal) {
    return 'normal';
  }
  if (value <= bad) {
    return 'bad';
  }
  return 'veryBad';
}

export function getPm10Grade(conditions: Pick<WeatherConditions, 'pm10'>): DustGrade | null {
  if (conditions.pm10 == null) {
    return null;
  }

  return calculateDustGrade(conditions.pm10, PM10_GRADE_THRESHOLDS);
}

export function getPm25Grade(conditions: Pick<WeatherConditions, 'pm25'>): DustGrade | null {
  if (conditions.pm25 == null) {
    return null;
  }

  return calculateDustGrade(conditions.pm25, PM25_GRADE_THRESHOLDS);
}

export function getTemperatureTone(temperature: number): TemperatureTone {
  const matched = TEMPERATURE_TONE_THRESHOLDS.find(([minimum]) => temperature >= minimum);
  return matched?.[1] ?? 'cold';
}

export const WeatherPolicy = {
  isWithinSupportedBounds,
  isRelocationNeeded,
  isSupportedLocation,
  shouldShowPrecipitation,
  shouldShowHourlyPrecipitation,
  hasHourlyForecasts,
  pm10Grade: getPm10Grade,
  pm25Grade: getPm25Grade,
  temperatureTone: getTemperatureTone,
} as const;
