import { aiReportIdParamSchema } from '@aido/api/contracts/ai/v1';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { SAMPLE_REPORT_COUNT } from '../constants/sample-report.constants';
import { reportTypeSchema } from '../domains/report.model';

export const reportParamsSchema = z.object({
  reportId: routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id),
});

/** 무료 리포트 화면의 예시 리포트. `?type=WEEKLY&periodsAgo=1`(1이 지난주·지난달) */
export const sampleReportParamsSchema = z.object({
  type: reportTypeSchema,
  periodsAgo: routeIntegerStringSchema.pipe(z.coerce.number().int().max(SAMPLE_REPORT_COUNT)),
});

export const reportListTypeSchema = reportTypeSchema.catch('WEEKLY');
