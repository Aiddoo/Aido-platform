import { aiReportIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { isSampleReportId } from '../constants/sample-reports';

const sampleReportSchema = z
  .string()
  .refine(isSampleReportId)
  .transform((id) => ({ kind: 'sample' as const, id }));

const savedReportSchema = routeIntegerStringSchema
  .pipe(aiReportIdParamSchema.shape.id)
  .transform((id) => ({ kind: 'saved' as const, id }));

/** 리포트 상세는 미리보기 샘플 id(sample-weekly 등) 또는 저장된 리포트의 숫자 id를 받는다. */
export const reportScreenParamsSchema = z.object({
  id: z.union([sampleReportSchema, savedReportSchema]),
});

export function useReportScreenParams() {
  return reportScreenParamsSchema.parse(useLocalSearchParams());
}
