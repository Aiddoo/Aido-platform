import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from "@aido/api/vocabulary";
import { z } from "zod";

import type {
  PlannedActionDraft,
  QuickPlanDraft,
} from "../../../../domain/types/planning/action-plan-draft.types.js";
import {
  dateRefSchema,
  planRepeatRefSchema,
  timeRefSchema,
} from "../../parsing/schedule/schedule-expression.schema.js";

/**
 * 계획 행동 LLM schema(관대). 행동 종류는 이 유니온만 허용하고, 개수·길이·id는 서버 정규화가
 * 다시 맞춘다. 설명은 ko/en 프롬프트에 함께 전달되므로 로케일 중립 영어로 쓴다.
 */
const createTodoActionSchema = z.object({
  type: z.literal("CREATE_TODO"),
  title: z.string().describe("Core action only, in the language the user spoke."),
  categoryId: z.number().int().nullable().describe("One id from context.categories, or null."),
  date: dateRefSchema,
  endDate: dateRefSchema
    .nullable()
    .describe(
      "Only for a stated span ('until X', 'from A to B', 'all next week'). null otherwise.",
    ),
  time: timeRefSchema.nullable().describe("null when no time is mentioned (all-day)."),
  repeat: planRepeatRefSchema,
  visibility: z
    .enum(TODO_VISIBILITIES)
    .extract(["PRIVATE"])
    .nullable()
    .describe("PRIVATE only when the user asks to keep it private. null otherwise."),
  items: z
    .array(z.string())
    .describe(`Sub-items the user listed, in order, at most ${TODO_ITEM_LIMITS.MAX_PER_TODO}.`),
  duplicateOfTodoId: z
    .number()
    .int()
    .nullable()
    .describe("id from context.upcomingTodos when this is the same to-do, or null."),
});

const createMemoActionSchema = z.object({
  type: z.literal("CREATE_MEMO"),
  title: z.string().describe("Short memo title in the spoken language."),
  content: z.string().describe("What the user asked to note, in the spoken language."),
});

export const plannedActionDraftSchema = z.discriminatedUnion("type", [
  createTodoActionSchema,
  createMemoActionSchema,
]) satisfies z.ZodType<PlannedActionDraft>;

export const quickPlanDraftSchema = z.object({
  actions: z
    .array(plannedActionDraftSchema)
    .describe(
      `Actions in spoken order: at most ${ACTION_PLAN_LIMITS.MAX_TODOS} CREATE_TODO and ${ACTION_PLAN_LIMITS.MAX_MEMOS} CREATE_MEMO. [] when there is nothing to do.`,
    ),
}) satisfies z.ZodType<QuickPlanDraft>;
