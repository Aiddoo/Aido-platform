import { aiReportSchema, reportStatusSchema, reportTypeSchema } from '@aido/api';
import { z } from 'zod';

export type ReportType = z.infer<typeof reportTypeSchema>;

export const aiReportModelSchema = aiReportSchema.extend({ generatedAt: z.date() });
export type AiReport = z.infer<typeof aiReportModelSchema>;

export const reportStatusModelSchema = reportStatusSchema.extend({
  nextWeeklyAt: z.date(),
  nextMonthlyAt: z.date(),
  latestWeekly: aiReportModelSchema.nullable(),
  latestMonthly: aiReportModelSchema.nullable(),
});
export type ReportStatus = z.infer<typeof reportStatusModelSchema>;

export const getAiReportsParamsSchema = z.object({
  type: reportTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
});
export type GetAiReportsParams = z.infer<typeof getAiReportsParamsSchema>;
