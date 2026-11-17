import { z } from "zod";

import { llmObject } from "../../../generation/application/messages/llm-output.wire.js";

/** 코치 카드 한 장. 길이·개수·숫자 근거는 서버가 맞춘다. */
export const reportDraftSchema = llmObject({
  insightKey: z
    .string()
    .nullable()
    .describe("report_data.focus.items key the insight is about; null = overall"),
  insight: z
    .string()
    .describe(
      "One sentence in the app language about the insightKey item: the single most useful pattern, not a recap of the charts. At most one number, copied exactly from that item or stats; compare other items in words.",
    ),
  tips: z
    .array(z.string())
    .describe(
      "1-2 tips; each one short sentence = condition + one small action for this week/month; no digits; different from previousTips.",
    ),
});

export type ReportDraft = z.infer<typeof reportDraftSchema>;
