import { z } from "zod";

import { ACTION_PLAN_LIMITS } from "../../../vocabulary/ai.constants.js";
import { QUICK_PLAN_SOURCES } from "../../../vocabulary/voice.constants.js";

export const quickPlanRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요")
    .max(
      ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH,
      `내용은 ${ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH}자 이하로 입력해주세요`,
    )
    .describe(`말하거나 적은 글자 (1-${ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH}자)`),
  source: z.enum(QUICK_PLAN_SOURCES).describe("입력 경로 (VOICE: 기기가 전사한 말, TEXT: 글)"),
});

export type QuickPlanRequest = z.infer<typeof quickPlanRequestSchema>;
