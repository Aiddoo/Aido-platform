import {
  createRemindNudgeResponseSchema,
  nudgeDetailSchema,
  receivedNudgesResponseSchema,
  sentNudgesResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const NudgeDetailDto = nudgeDetailSchema.meta({ id: "NudgeDetailDto" });
export type NudgeDetailDto = z.infer<typeof NudgeDetailDto>;

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
