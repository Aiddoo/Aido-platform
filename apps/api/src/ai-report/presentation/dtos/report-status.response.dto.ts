import { reportStatusResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const ReportStatusResponseDto = reportStatusResponseSchema.meta({
	id: "ReportStatusResponseDto",
});
export type ReportStatusResponseDto = z.infer<typeof ReportStatusResponseDto>;
