import { z } from "zod";

import { llmInteger, llmObject } from "../../../generation/application/messages/llm-output.wire.js";
import { TODO_DRAFT_INTENTS, type TodoDraft } from "../../../shared/domain/todo-draft.constants.js";
import {
  dateRefSchema,
  nullableDateRefSchema,
  nullableTimeRefSchema,
  repeatRefSchema,
} from "./schedule-expression.wire.js";

/** parse-todo·parse-memo 할 일 칸. 길이 제한은 서버 정규화가 맞춘다. */
export const todoDraftShape = {
  intent: z.enum(TODO_DRAFT_INTENTS),
  title: z.string().describe("Core action only, in the input's language."),
  date: dateRefSchema,
  endDate: nullableDateRefSchema.describe(
    "Only for 'until X', 'from A to B', 'for N days'. null otherwise.",
  ),
  time: nullableTimeRefSchema,
  repeat: repeatRefSchema,
  categoryId: llmInteger().nullable().describe("One id from context.categories, or null."),
};

/** parse-todo LLM 출력 schema(관대). */
export const todoDraftSchema = llmObject(todoDraftShape) satisfies z.ZodType<TodoDraft>;
