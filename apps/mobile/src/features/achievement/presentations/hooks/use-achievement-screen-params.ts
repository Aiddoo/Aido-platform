import { weeklyAchievementParamSchema } from '@aido/validators';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const achievementScreenParamsSchema = z.object({
  year: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.year),
  week: routeIntegerStringSchema.pipe(weeklyAchievementParamSchema.shape.week),
});

export function useAchievementScreenParams() {
  return achievementScreenParamsSchema.parse(useLocalSearchParams());
}
