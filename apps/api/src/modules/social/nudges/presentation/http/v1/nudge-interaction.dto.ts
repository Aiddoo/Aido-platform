import {
  getNudgeInteractionsQuerySchema,
  getNudgeThanksPreviewQuerySchema,
  nudgeTodoIdParamSchema,
  replyToNudgeSchema,
  sendNudgeThanksSchema,
  nudgeInteractionAvailabilityResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  nudgeThanksPreviewResponseSchema,
  sendNudgeThanksResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const GetNudgeInteractionsQueryDto = getNudgeInteractionsQuerySchema.meta({
  id: "GetNudgeInteractionsQueryDto",
  apiParameter: true,
});
export type GetNudgeInteractionsQueryDto = z.infer<typeof GetNudgeInteractionsQueryDto>;

export const GetNudgeThanksPreviewQueryDto = getNudgeThanksPreviewQuerySchema.meta({
  id: "GetNudgeThanksPreviewQueryDto",
  apiParameter: true,
});
export type GetNudgeThanksPreviewQueryDto = z.infer<typeof GetNudgeThanksPreviewQueryDto>;

export const NudgeTodoIdParamDto = nudgeTodoIdParamSchema.meta({
  id: "NudgeTodoIdParamDto",
  apiParameter: true,
});
export type NudgeTodoIdParamDto = z.infer<typeof NudgeTodoIdParamDto>;

export const ReplyToNudgeDto = replyToNudgeSchema.meta({ id: "ReplyToNudgeDto" });
export type ReplyToNudgeDto = z.infer<typeof ReplyToNudgeDto>;

export const SendNudgeThanksDto = sendNudgeThanksSchema.meta({ id: "SendNudgeThanksDto" });
export type SendNudgeThanksDto = z.infer<typeof SendNudgeThanksDto>;

export const NudgeInteractionAvailabilityResponseDto =
  nudgeInteractionAvailabilityResponseSchema.meta({
    id: "NudgeInteractionAvailabilityResponseDto",
  });
export type NudgeInteractionAvailabilityResponseDto = z.infer<
  typeof NudgeInteractionAvailabilityResponseDto
>;

export const NudgeInteractionResponseDto = nudgeInteractionResponseSchema.meta({
  id: "NudgeInteractionResponseDto",
});
export type NudgeInteractionResponseDto = z.infer<typeof NudgeInteractionResponseDto>;

export const NudgeInteractionsResponseDto = nudgeInteractionsResponseSchema.meta({
  id: "NudgeInteractionsResponseDto",
});
export type NudgeInteractionsResponseDto = z.infer<typeof NudgeInteractionsResponseDto>;

export const NudgeThanksPreviewResponseDto = nudgeThanksPreviewResponseSchema.meta({
  id: "NudgeThanksPreviewResponseDto",
});
export type NudgeThanksPreviewResponseDto = z.infer<typeof NudgeThanksPreviewResponseDto>;

export const SendNudgeThanksResponseDto = sendNudgeThanksResponseSchema.meta({
  id: "SendNudgeThanksResponseDto",
});
export type SendNudgeThanksResponseDto = z.infer<typeof SendNudgeThanksResponseDto>;
