import {
  applyActionPlanRequestSchema,
  applyActionPlanResponseSchema,
  quickPlanRequestSchema,
  quickPlanResponseSchema,
} from "@aido/api/contracts/voice";
import type { z } from "zod";

export const QuickPlanRequestDto = quickPlanRequestSchema.meta({ id: "QuickPlanRequestDto" });
export type QuickPlanRequestDto = z.infer<typeof QuickPlanRequestDto>;
export const QuickPlanResponseDto = quickPlanResponseSchema.meta({ id: "QuickPlanResponseDto" });
export type QuickPlanResponseDto = z.infer<typeof QuickPlanResponseDto>;
export const ApplyActionPlanRequestDto = applyActionPlanRequestSchema.meta({
  id: "ApplyActionPlanRequestDto",
});
export type ApplyActionPlanRequestDto = z.infer<typeof ApplyActionPlanRequestDto>;
export const ApplyActionPlanResponseDto = applyActionPlanResponseSchema.meta({
  id: "ApplyActionPlanResponseDto",
});
export type ApplyActionPlanResponseDto = z.infer<typeof ApplyActionPlanResponseDto>;
