import { weeklyAchievementParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

export const achievementParamsSchema = z.object({
  year: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.year),
  week: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week),
});
