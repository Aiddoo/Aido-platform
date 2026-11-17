import {
  aiReportIdParamSchema,
  aiReportListResponseSchema,
  aiReportResponseSchema,
  getAiReportsQuerySchema,
  reportStatusResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const AiReportResponseDto = aiReportResponseSchema.meta({ id: "AiReportResponseDto" });
export type AiReportResponseDto = z.infer<typeof AiReportResponseDto>;
export const AiReportListResponseDto = aiReportListResponseSchema.meta({
  id: "AiReportListResponseDto",
});
export type AiReportListResponseDto = z.infer<typeof AiReportListResponseDto>;

export const AiReportIdParamDto = aiReportIdParamSchema.meta({
  id: "AiReportIdParamDto",
  apiParameter: true,
});
export type AiReportIdParamDto = z.infer<typeof AiReportIdParamDto>;

export const GetAiReportsQueryDto = getAiReportsQuerySchema.meta({
  id: "GetAiReportsQueryDto",
  apiParameter: true,
});
export type GetAiReportsQueryDto = z.infer<typeof GetAiReportsQueryDto>;

export const ReportStatusResponseDto = reportStatusResponseSchema.meta({
  id: "ReportStatusResponseDto",
});
export type ReportStatusResponseDto = z.infer<typeof ReportStatusResponseDto>;
