import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";
import { z } from "zod";

import type { VoiceNoteDigestDraft } from "../../../../domain/types/planning/action-plan-draft.types.js";
import { llmInteger, llmObject } from "../../kit/llm-object.js";
import { actionPlanDraftShape } from "../quick-plan/schema.js";

/** 녹음 정리 LLM schema(관대). 제목·요약·핵심 포인트는 앱 언어, 할 일 제목은 말한 언어다. */
export const voiceNoteDigestDraftSchema = llmObject({
  title: z.string().describe("Short title of the recording in the app language."),
  summary: z.string().describe("2-4 sentences in the app language."),
  keyPoints: z
    .array(
      llmObject({
        text: z.string().describe("One sentence in the app language."),
        sentenceIndex: llmInteger()
          .nullable()
          .describe("index of the transcript sentence this point comes from, or null."),
      }),
    )
    .describe(`At most ${ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS}, bookmarked sentences first.`),
  ...actionPlanDraftShape,
}) satisfies z.ZodType<VoiceNoteDigestDraft>;
