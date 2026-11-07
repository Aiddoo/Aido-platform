import {
  aiReportListResponseSchema,
  aiReportSchema as aiReportContractSchema,
  aiReportResponseSchema,
  reportStatusResponseSchema,
  reportStatusSchema as reportStatusContractSchema,
  reportTypeSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export { reportTypeSchema };
export type ReportType = z.infer<typeof reportTypeSchema>;

const aiReportSchema = aiReportContractSchema.extend({ generatedAt: instantSchema });
export type AiReport = z.infer<typeof aiReportSchema>;

const reportStatusSchema = reportStatusContractSchema.extend({
  nextWeeklyAt: instantSchema,
  nextMonthlyAt: instantSchema,
  latestWeekly: aiReportSchema.nullable(),
  latestMonthly: aiReportSchema.nullable(),
});

export const reportStatusResultSchema = reportStatusResponseSchema.extend({
  status: reportStatusSchema,
});
export const reportListResultSchema = aiReportListResponseSchema.extend({
  reports: z.array(aiReportSchema),
});
export const reportDetailResultSchema = aiReportResponseSchema.extend({ report: aiReportSchema });

export interface GetAiReportsParams {
  type?: ReportType;
  limit?: number;
}
