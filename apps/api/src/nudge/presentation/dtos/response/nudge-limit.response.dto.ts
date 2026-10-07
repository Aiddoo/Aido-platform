import {
  createNudgeResponseSchema,
  markNudgeReadResponseSchema,
  nudgeLimitInfoSchema,
} from "@aido/api";
import type { z } from "zod";

export const NudgeLimitInfoDto = nudgeLimitInfoSchema.meta({ id: "NudgeLimitInfoDto" });
export type NudgeLimitInfoDto = z.infer<typeof NudgeLimitInfoDto>;

export const CreateNudgeResponseDto = createNudgeResponseSchema.meta({
  id: "CreateNudgeResponseDto",
});
export type CreateNudgeResponseDto = z.infer<typeof CreateNudgeResponseDto>;

export const MarkNudgeReadResponseDto = markNudgeReadResponseSchema.meta({
  id: "MarkNudgeReadResponseDto",
});
export type MarkNudgeReadResponseDto = z.infer<typeof MarkNudgeReadResponseDto>;
