import { weeklyAchievementParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const achievementParamsSchema = z.object({
  year: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.year),
  week: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week),
});

const ROUTE_YEAR_PATTERN = /^\d{4}$/;

// 배지 화면에서 고른 ISO 연도. 쓰는 값이라 URL 문자열과 숫자를 오가는 codec이다
const routeYearSchema = z.codec(z.string().regex(ROUTE_YEAR_PATTERN), z.int(), {
  decode: Number,
  encode: String,
});

export const achievementListParamsSchema = z.object({
  year: routeYearSchema.optional().catch(undefined),
});
