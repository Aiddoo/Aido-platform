import { dayOfWeekSchema } from "@aido/api";
import { z } from "zod";

/** LLM 출력 schema(관대). 후보 검증·요일·시각·신뢰도는 서버가 정한다. */
export const suggestionDraftSchema = z.object({
  picks: z
    .array(
      z.object({
        candidateId: z.string(),
        daysOfWeek: z.array(dayOfWeekSchema),
        useRecordedTime: z.boolean(),
        reason: z
          .string()
          .describe("One sentence in the requested language using only the candidate's numbers."),
      }),
    )
    .describe("0-5 picks, best first."),
});

export type SuggestionDraft = z.infer<typeof suggestionDraftSchema>;
