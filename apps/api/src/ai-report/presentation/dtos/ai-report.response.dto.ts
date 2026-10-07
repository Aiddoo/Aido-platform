import { aiReportListResponseSchema, aiReportResponseSchema } from "@aido/api";
import type { z } from "zod";

export const AiReportResponseDto = aiReportResponseSchema.meta({ id: "AiReportResponseDto" });
export type AiReportResponseDto = z.infer<typeof AiReportResponseDto>;
export const AiReportListResponseDto = aiReportListResponseSchema.meta({
  id: "AiReportListResponseDto",
});
export type AiReportListResponseDto = z.infer<typeof AiReportListResponseDto>;
