import { z } from 'zod';

import { LATITUDE_RANGE, LONGITUDE_RANGE } from './weather.constants';

export const updateLocationSchema = z.object({
  latitude: z
    .number()
    .min(LATITUDE_RANGE.MIN)
    .max(LATITUDE_RANGE.MAX)
    .describe('위도 (WGS84, 한국 범위 33.0~39.0)'),
  longitude: z
    .number()
    .min(LONGITUDE_RANGE.MIN)
    .max(LONGITUDE_RANGE.MAX)
    .describe('경도 (WGS84, 한국 범위 124.0~132.0)'),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const getForecastQuerySchema = z.object({
  date: z.iso.date().optional().describe('예보 날짜 (YYYY-MM-DD, 기본: 오늘)'),
});

export type GetForecastQuery = z.infer<typeof getForecastQuerySchema>;
