import {
  getNudgesQuerySchema,
  nudgeIdParamSchema,
  createNudgeSchema,
  createRemindNudgeSchema,
  nudgeCooldownInfoSchema,
  createNudgeResponseSchema,
  markNudgeReadResponseSchema,
  nudgeLimitInfoSchema,
  createRemindNudgeResponseSchema,
  receivedNudgesResponseSchema,
  sentNudgesResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const GetNudgesQueryDto = getNudgesQuerySchema.meta({
  id: "GetNudgesQueryDto",
  apiParameter: true,
});
export type GetNudgesQueryDto = z.infer<typeof GetNudgesQueryDto>;

export const NudgeIdParamDto = nudgeIdParamSchema.meta({
  id: "NudgeIdParamDto",
  apiParameter: true,
});
export type NudgeIdParamDto = z.infer<typeof NudgeIdParamDto>;

export const SendNudgeDto = createNudgeSchema.meta({ id: "SendNudgeDto" });
export type SendNudgeDto = z.infer<typeof SendNudgeDto>;

export const SendRemindNudgeDto = createRemindNudgeSchema.meta({ id: "SendRemindNudgeDto" });
export type SendRemindNudgeDto = z.infer<typeof SendRemindNudgeDto>;

export const NudgeCooldownResponseDto = nudgeCooldownInfoSchema.meta({
  id: "NudgeCooldownResponseDto",
});
export type NudgeCooldownResponseDto = z.infer<typeof NudgeCooldownResponseDto>;

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

export const ReceivedNudgesResponseDto = receivedNudgesResponseSchema.meta({
  id: "ReceivedNudgesResponseDto",
});
export type ReceivedNudgesResponseDto = z.infer<typeof ReceivedNudgesResponseDto>;

export const SentNudgesResponseDto = sentNudgesResponseSchema.meta({ id: "SentNudgesResponseDto" });
export type SentNudgesResponseDto = z.infer<typeof SentNudgesResponseDto>;

export const CreateRemindNudgeResponseDto = createRemindNudgeResponseSchema.meta({
  id: "CreateRemindNudgeResponseDto",
});
export type CreateRemindNudgeResponseDto = z.infer<typeof CreateRemindNudgeResponseDto>;
