import { resolveUserReportParamSchema, resolveUserReportSchema } from "@aido/api";
import type { z } from "zod";

export const ResolveUserReportParamDto = resolveUserReportParamSchema.meta({
  id: "ResolveUserReportParamDto",
});
export type ResolveUserReportParamDto = z.infer<typeof ResolveUserReportParamDto>;

export const ResolveUserReportDto = resolveUserReportSchema.meta({ id: "ResolveUserReportDto" });
export type ResolveUserReportDto = z.infer<typeof ResolveUserReportDto>;
