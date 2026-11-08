import type { reportTypeSchema } from '@aido/api';
import {
  aiReportListResponseSchema,
  aiReportSchema as aiReportContractSchema,
  getAiReportsQuerySchema,
  aiReportResponseSchema,
  reportStatusResponseSchema,
  reportStatusSchema as reportStatusContractSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

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

/** 계약은 문자열 query를 숫자로 바꿔 입력 타입이 unknown이다. 앱은 바꾼 뒤의 값을 보내고 모든 칸을 생략할 수 있다 */
const getReportsQuerySchema = getAiReportsQuerySchema.partial();
export type GetAiReportsQuery = z.output<typeof getReportsQuerySchema>;
