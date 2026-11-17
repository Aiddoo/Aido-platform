import {
  createRemindNudgeResponseSchema,
  createRemindNudgeSchema,
} from "@aido/api/contracts/nudge/v1";
import type { z } from "zod";

export const SendRemindNudgeDto = createRemindNudgeSchema.meta({ id: "SendRemindNudgeDto" });
export type SendRemindNudgeDto = z.infer<typeof SendRemindNudgeDto>;

export const CreateRemindNudgeResponseDto = createRemindNudgeResponseSchema.meta({
  id: "CreateRemindNudgeResponseDto",
});
export type CreateRemindNudgeResponseDto = z.infer<typeof CreateRemindNudgeResponseDto>;
