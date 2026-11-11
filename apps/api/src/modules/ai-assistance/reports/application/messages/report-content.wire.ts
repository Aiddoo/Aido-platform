import { z } from "zod";

import { llmObject } from "../../../generation/application/messages/llm-output.wire.js";

/** LLM 출력 schema(관대). 개수·길이는 서버가 맞춘다. */
export const reportDraftSchema = llmObject({
  summary: z.string().describe("3-5 sentences in the requested language."),
  tips: z.array(z.string()).describe("1-3 tips, one sentence each."),
});

export type ReportDraft = z.infer<typeof reportDraftSchema>;
