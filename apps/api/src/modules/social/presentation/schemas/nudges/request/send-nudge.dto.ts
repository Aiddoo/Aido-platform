import {
  createNudgeSchema,
  createRemindNudgeSchema,
  markNudgeReadSchema,
  markNudgesReadSchema,
} from "@aido/api";
import type { z } from "zod";

export const SendNudgeDto = createNudgeSchema.meta({ id: "SendNudgeDto" });
export type SendNudgeDto = z.infer<typeof SendNudgeDto>;

export const SendRemindNudgeDto = createRemindNudgeSchema.meta({ id: "SendRemindNudgeDto" });
export type SendRemindNudgeDto = z.infer<typeof SendRemindNudgeDto>;

export const MarkNudgeReadDto = markNudgeReadSchema.meta({ id: "MarkNudgeReadDto" });
export type MarkNudgeReadDto = z.infer<typeof MarkNudgeReadDto>;

export const MarkNudgesReadDto = markNudgesReadSchema.meta({ id: "MarkNudgesReadDto" });
export type MarkNudgesReadDto = z.infer<typeof MarkNudgesReadDto>;
