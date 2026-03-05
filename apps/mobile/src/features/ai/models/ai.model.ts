import { aiReportSchema, reportStatusSchema, reportTypeSchema } from '@aido/validators';
import { z } from 'zod';

export const aiReportModelSchema = aiReportSchema.extend({
  generatedAt: z.coerce.date(),
});
export type AiReport = z.infer<typeof aiReportModelSchema>;

export const reportStatusModelSchema = reportStatusSchema.extend({
  nextWeeklyAt: z.coerce.date(),
  nextMonthlyAt: z.coerce.date(),
  latestWeekly: aiReportModelSchema.nullable(),
  latestMonthly: aiReportModelSchema.nullable(),
});
export type ReportStatus = z.infer<typeof reportStatusModelSchema>;

export const getAiReportsParamsSchema = z.object({
  type: reportTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
});
export type GetAiReportsParams = z.infer<typeof getAiReportsParamsSchema>;
