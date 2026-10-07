import { aiReportIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const reportScreenParamsSchema = z.object({
  id: routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id),
});

export function useReportScreenParams() {
  return reportScreenParamsSchema.parse(useLocalSearchParams());
}
