import { nudgeIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const nudgeScreenParamsSchema = z.object({
  nudgeId: routeIntegerStringSchema.pipe(nudgeIdParamSchema.shape.id),
});

export function useNudgeScreenParams() {
  return nudgeScreenParamsSchema.parse(useLocalSearchParams());
}
