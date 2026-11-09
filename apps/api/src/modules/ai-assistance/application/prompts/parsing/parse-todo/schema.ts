import { z } from "zod";

import type { TodoDraft } from "../../../../domain/types/parsing/todo-draft.types.js";
import { llmInteger, llmObject } from "../../kit/llm-object.js";
import {
  dateRefSchema,
  nullableDateRefSchema,
  nullableTimeRefSchema,
  repeatRefSchema,
} from "../schedule/schedule-expression.schema.js";

/** parse-todo·parse-memo 할 일 칸. 길이 제한은 서버 정규화가 맞춘다. */
export const todoDraftShape = {
  intent: z.enum(["TASK", "NO_ACTION"]),
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
