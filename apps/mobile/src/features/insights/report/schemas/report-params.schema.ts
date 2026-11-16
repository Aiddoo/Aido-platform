import { aiReportIdParamSchema } from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { reportTypeSchema } from '../domains/report.model';

export const reportParamsSchema = z.object({
  reportId: routeIntegerStringSchema.pipe(aiReportIdParamSchema.shape.id),
});

/** 리포트 목록의 주간·월간 탭. `?type=` */
export const reportListTypeSchema = reportTypeSchema.catch('WEEKLY');
