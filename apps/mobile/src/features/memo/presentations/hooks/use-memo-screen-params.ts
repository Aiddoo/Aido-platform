import { memoIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const memoScreenParamsSchema = z.object({
  id: routeIntegerStringSchema.pipe(memoIdParamSchema.shape.id),
});

export function useMemoScreenParams() {
  return memoScreenParamsSchema.parse(useLocalSearchParams());
}
