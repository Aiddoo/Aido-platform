import { z } from "zod";

import type { TodoDraft } from "../../../../domain/types/parsing/todo-draft.types.js";
import {
  dateRefSchema,
  repeatRefSchema,
  timeRefSchema,
} from "../schedule/schedule-expression.schema.js";

/** parse-todo LLM 출력 schema(관대). 길이 제한은 서버 정규화가 맞춘다. */
export const todoDraftSchema = z.object({
  intent: z.enum(["TASK", "NO_ACTION"]),
  title: z.string().describe("Core action only, in the input's language."),
  date: dateRefSchema,
  endDate: dateRefSchema.optional().describe("Only for 'until X', 'from A to B', 'for N days'."),
  time: timeRefSchema.nullable().describe("null when no time is mentioned (all-day)."),
  repeat: repeatRefSchema,
  categoryId: z.number().int().optional().describe("One id from context.categories, or omit."),
}) satisfies z.ZodType<TodoDraft>;
