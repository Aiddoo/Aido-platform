import {
  createUserReportSchema,
  createUserReportResponseSchema,
  resolveUserReportParamSchema,
  resolveUserReportSchema,
  resolveUserReportResponseSchema,
} from "@aido/api/contracts/user-report";
import type { z } from "zod";

export const CreateUserReportDto = createUserReportSchema.meta({ id: "CreateUserReportDto" });
export type CreateUserReportDto = z.infer<typeof CreateUserReportDto>;

export const CreateUserReportResponseDto = createUserReportResponseSchema.meta({
  id: "CreateUserReportResponseDto",
});
export type CreateUserReportResponseDto = z.infer<typeof CreateUserReportResponseDto>;

export const ResolveUserReportParamDto = resolveUserReportParamSchema.meta({
  id: "ResolveUserReportParamDto",
  apiParameter: true,
});
export type ResolveUserReportParamDto = z.infer<typeof ResolveUserReportParamDto>;

export const ResolveUserReportDto = resolveUserReportSchema.meta({ id: "ResolveUserReportDto" });
export type ResolveUserReportDto = z.infer<typeof ResolveUserReportDto>;

export const ResolveUserReportResponseDto = resolveUserReportResponseSchema.meta({
  id: "ResolveUserReportResponseDto",
});
export type ResolveUserReportResponseDto = z.infer<typeof ResolveUserReportResponseDto>;
