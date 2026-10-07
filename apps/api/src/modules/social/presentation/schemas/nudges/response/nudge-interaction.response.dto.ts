import {
  nudgeInteractionAvailabilityResponseSchema,
  nudgeInteractionResponseSchema,
  nudgeInteractionsResponseSchema,
  nudgeThanksPreviewResponseSchema,
  sendNudgeThanksResponseSchema,
} from "@aido/api";
import type { z } from "zod";

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
