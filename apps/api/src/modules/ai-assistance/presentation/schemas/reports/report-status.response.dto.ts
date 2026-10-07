import { reportStatusResponseSchema } from "@aido/api";
import type { z } from "zod";

export const ReportStatusResponseDto = reportStatusResponseSchema.meta({
  id: "ReportStatusResponseDto",
});
export type ReportStatusResponseDto = z.infer<typeof ReportStatusResponseDto>;
