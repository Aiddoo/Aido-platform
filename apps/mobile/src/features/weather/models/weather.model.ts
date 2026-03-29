import { PRECIPITATION_TYPES, SKY_CONDITIONS } from '@aido/validators';
import { z } from 'zod';

export const HourlyForecastSchema = z.object({
  hour: z.number().int().min(0).max(23),
  temperature: z.number(),
  skyCondition: z.enum(SKY_CONDITIONS),
  precipitationProbability: z.number().int().min(0).max(100),
});

export type HourlyForecast = z.infer<typeof HourlyForecastSchema>;

export const WeatherForecastSchema = z.object({
  date: z.date(),
  skyCondition: z.enum(SKY_CONDITIONS),
  precipitationType: z.enum(PRECIPITATION_TYPES),
  precipitationProbability: z.number().int().min(0).max(100),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
  humidity: z.number().int().min(0).max(100),
  windSpeed: z.number(),
  hourlyForecasts: z.array(HourlyForecastSchema),
});

export type WeatherForecast = z.infer<typeof WeatherForecastSchema>;

export const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  gridX: z.number().int(),
  gridY: z.number().int(),
});

export type Location = z.infer<typeof LocationSchema>;

/** Weather 도메인 비즈니스 규칙 */
export const WeatherPolicy = {
  /** 강수 배지 표시 여부 (강수 타입이 있고, 확률 30% 이상일 때) */
  shouldShowPrecipitation(forecast: WeatherForecast): boolean {
    return forecast.precipitationType !== 'NONE' && forecast.precipitationProbability >= 30;
  },
  /** 시간별 강수 확률 표시 여부 (30% 이상일 때) */
  shouldShowHourlyPrecipitation(hourly: HourlyForecast): boolean {
    return hourly.precipitationProbability >= 30;
  },
  /** 시간별 예보 펼침 가능 여부 */
  isExpandable(forecast: WeatherForecast): boolean {
    return forecast.hourlyForecasts.length > 0;
  },
} as const;
