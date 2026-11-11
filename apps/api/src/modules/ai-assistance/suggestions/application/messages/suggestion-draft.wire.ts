import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import { llmObject } from "../../../generation/application/messages/llm-output.wire.js";

/** LLM 출력 schema(관대). 후보 검증·요일·시각·신뢰도는 서버가 정한다. */
export const suggestionDraftSchema = llmObject({
  picks: z
    .array(
      llmObject({
        candidateId: z.string(),
        daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)),
        useRecordedTime: z.boolean(),
        reason: z
          .string()
          .describe("One sentence in the requested language using only the candidate's numbers."),
      }),
    )
    .describe("0-5 picks, best first."),
});

export type SuggestionDraft = z.infer<typeof suggestionDraftSchema>;
