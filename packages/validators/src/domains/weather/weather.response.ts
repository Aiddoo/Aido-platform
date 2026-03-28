import { z } from 'zod';
import { datetimeSchema } from '../../common/datetime';
import { PRECIPITATION_TYPE, SKY_CONDITION } from './weather.constants';

const skyConditionValues = Object.values(SKY_CONDITION) as [string, ...string[]];
const precipitationTypeValues = Object.values(PRECIPITATION_TYPE) as [string, ...string[]];

export const hourlyForecastSchema = z.object({
  hour: z.number().int().min(0).max(23).describe('시간 (0-23)'),
  temperature: z.number().describe('기온 (°C)'),
  skyCondition: z.enum(skyConditionValues).describe('하늘 상태'),
  precipitationProbability: z.number().int().min(0).max(100).describe('강수 확률 (%)'),
});

export type HourlyForecast = z.infer<typeof hourlyForecastSchema>;

export const weatherForecastSchema = z
  .object({
    date: datetimeSchema.describe('예보 날짜'),
    skyCondition: z.enum(skyConditionValues).describe('하늘 상태'),
    precipitationType: z.enum(precipitationTypeValues).describe('강수 형태'),
    precipitationProbability: z.number().int().min(0).max(100).describe('강수 확률 (%)'),
    temperatureMin: z.number().describe('최저 기온 (°C)'),
    temperatureMax: z.number().describe('최고 기온 (°C)'),
    humidity: z.number().int().min(0).max(100).describe('습도 (%)'),
    windSpeed: z.number().describe('풍속 (m/s)'),
    hourlyForecasts: z.array(hourlyForecastSchema).describe('시간별 예보'),
  })
  .meta({
    example: {
      date: '2026-03-28T00:00:00.000Z',
      skyCondition: 'CLEAR',
      precipitationType: 'NONE',
      precipitationProbability: 10,
      temperatureMin: 8,
      temperatureMax: 18,
      humidity: 45,
      windSpeed: 2.5,
      hourlyForecasts: [
        { hour: 9, temperature: 12, skyCondition: 'CLEAR', precipitationProbability: 0 },
        { hour: 15, temperature: 18, skyCondition: 'PARTLY_CLOUDY', precipitationProbability: 10 },
      ],
    },
  });

export type WeatherForecastResponse = z.infer<typeof weatherForecastSchema>;

export const locationResponseSchema = z
  .object({
    latitude: z.number().describe('위도'),
    longitude: z.number().describe('경도'),
    gridX: z.number().int().describe('기상청 격자 X'),
    gridY: z.number().int().describe('기상청 격자 Y'),
  })
  .meta({
    example: {
      latitude: 37.5665,
      longitude: 126.978,
      gridX: 60,
      gridY: 127,
    },
  });

export type LocationResponse = z.infer<typeof locationResponseSchema>;
