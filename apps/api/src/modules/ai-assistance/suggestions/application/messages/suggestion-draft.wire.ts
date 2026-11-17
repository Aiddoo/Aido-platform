import { DAYS_OF_WEEK } from "@aido/api/vocabulary";
import { z } from "zod";

import { llmObject } from "../../../generation/application/messages/llm-output.wire.js";

/** 모델은 후보만 고른다. 근거 문장·신뢰도·상한은 서버가 정한다. */
export const suggestionDraftSchema = llmObject({
  picks: z
    .array(
      llmObject({
        candidateId: z.string().describe("id from suggestion_data.candidates, copied exactly"),
        daysOfWeek: z
          .array(z.enum(DAYS_OF_WEEK))
          .describe("1-3 days from that candidate's days, most recorded first"),
        useRecordedTime: z.boolean().describe("true only when the candidate has recordedTime"),
      }),
    )
    .describe("0-5 picks (STARTER: 0-2), strongest evidence first; [] when evidence is weak"),
});

export type SuggestionDraft = z.infer<typeof suggestionDraftSchema>;
