import { aiReportIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { isSampleReportId } from '../constants/sample-reports.constants';
import { reportTypeSchema } from '../domains/report.model';

const sampleReportSchema = z
  .string()
  .refine(isSampleReportId)
  .transform((id) => ({ kind: 'sample' as const, id }));

const savedReportSchema = routeIntegerStringSchema
  .pipe(aiReportIdParamSchema.shape.id)
  .transform((id) => ({ kind: 'saved' as const, id }));

export const reportParamsSchema = z.object({
  reportId: z.union([sampleReportSchema, savedReportSchema]),
});

/** 리포트 목록의 주간·월간 탭. `?type=` */
export const reportListTypeSchema = reportTypeSchema.catch('WEEKLY');
