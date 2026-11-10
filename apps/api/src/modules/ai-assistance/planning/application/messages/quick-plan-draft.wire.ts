import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from "@aido/api/vocabulary";
import { z } from "zod";

import {
  llmInteger,
  llmObject,
  nullableLlmObject,
} from "../../../generation/application/messages/llm-output.wire.js";
import {
  dateRefSchema,
  nullableDateRefSchema,
  nullableTimeRefSchema,
  planRepeatRefSchema,
} from "../../../parsing/application/messages/schedule-expression.wire.js";
import type {
  MemoActionDraft,
  QuickPlanDraft,
  TodoActionDraft,
} from "../../domain/action-plan-draft.constants.js";

/**
 * 계획 LLM schema(관대). 개수·길이·id는 서버 정규화가 다시 맞춘다. 객체 유니온(anyOf) 배열은 Claude JSON 도구가
 * 문자열로 내보내다 JSON을 깨뜨리므로 쓰지 않는다. 설명은 ko/en 프롬프트에 함께 전달되므로 로케일 중립 영어로 쓴다.
 */
const todoActionDraftSchema = llmObject({
  title: z.string().describe("Core action only, in the language the user spoke."),
  categoryId: llmInteger().nullable().describe("One id from context.categories, or null."),
  date: dateRefSchema.describe(
    "The day the to-do starts or happens. NONE for a deadline ('by X') or when no start is said.",
  ),
  endDate: nullableDateRefSchema.describe(
    "The deadline or last day of a stated span ('by X', 'until X', 'from A to B', 'all next week'). null otherwise.",
  ),
  time: nullableTimeRefSchema,
  repeat: planRepeatRefSchema,
  visibility: z
    .enum(TODO_VISIBILITIES)
    .extract(["PRIVATE"])
    .nullable()
    .describe("PRIVATE only when the user asks to keep it private. null otherwise."),
  items: z
    .array(z.string())
    .describe(`Sub-items the user listed, in order, at most ${TODO_ITEM_LIMITS.MAX_PER_TODO}.`),
  duplicateOfTodoId: llmInteger()
    .nullable()
    .describe("id from context.upcomingTodos when this is the same to-do, or null."),
}) satisfies z.ZodType<TodoActionDraft>;

const memoActionDraftSchema = nullableLlmObject({
  title: z.string().describe("Short memo title in the spoken language."),
  content: z.string().describe("What the user asked to note, in the spoken language."),
}) satisfies z.ZodType<MemoActionDraft | null>;

/** quick-plan·voice-note-digest가 함께 쓰는 계획 칸 */
export const actionPlanDraftShape = {
  todos: z
    .array(todoActionDraftSchema)
    .describe(`To-dos in spoken order, at most ${ACTION_PLAN_LIMITS.MAX_TODOS}. [] when none.`),
  memo: memoActionDraftSchema.describe("One note the user asked to keep. null otherwise."),
};

export const quickPlanDraftSchema = llmObject(
  actionPlanDraftShape,
) satisfies z.ZodType<QuickPlanDraft>;
