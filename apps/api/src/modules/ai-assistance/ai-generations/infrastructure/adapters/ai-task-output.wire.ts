import type { z } from "zod";

import type { AiTaskId, AiTaskOutputs } from "../../application/ports/ai-generator.port.js";
import { memoDraftSchema } from "./parse-memo-draft.wire.js";
import { todoDraftSchema } from "./parse-todo-draft.wire.js";
import { quickPlanDraftSchema } from "./quick-plan-draft.wire.js";
import { reportDraftSchema } from "./report-draft.wire.js";
import { suggestionDraftSchema } from "./suggestion-draft.wire.js";
import { voiceNoteDigestDraftSchema } from "./voice-note-digest-draft.wire.js";

/** 작업마다 모델 출력을 받는 LLM schema(관대). 서버 정규화가 길이·개수·id를 다시 맞춘다 */
export const AI_TASK_OUTPUT_SCHEMAS: {
  readonly [Task in AiTaskId]: z.ZodType<AiTaskOutputs[Task]>;
} = {
  "parse-todo": todoDraftSchema,
  "parse-memo": memoDraftSchema,
  report: reportDraftSchema,
  suggestion: suggestionDraftSchema,
  "quick-plan": quickPlanDraftSchema,
  "voice-note-digest": voiceNoteDigestDraftSchema,
};
