import { resolveUserReportResponseSchema } from "@aido/api";
import type { z } from "zod";

export const ResolveUserReportResponseDto = resolveUserReportResponseSchema.meta({
  id: "ResolveUserReportResponseDto",
});
export type ResolveUserReportResponseDto = z.infer<typeof ResolveUserReportResponseDto>;
