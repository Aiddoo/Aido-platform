import { z } from "zod";

import { ACTION_PLAN_LIMITS } from "../../../vocabulary/ai.constants.js";
import { ACTION_PLAN_SOURCES } from "../../../vocabulary/voice.constants.js";
import { plannedMemoActionSchema, plannedTodoFields } from "./action-plan.common.js";

/** 저장할 때는 카테고리가 정해져 있어야 한다. 앱이 AI가 고르지 못한 할 일에 현재 카테고리를 넣어 보낸다. */
export const applyTodoActionSchema = z
  .object({
    ...plannedTodoFields,
    categoryId: z.number().int().positive().describe("저장할 카테고리 id"),
  })
  .refine((todo) => todo.repeat == null || todo.endDate == null, {
    error: "반복 할 일에는 종료 날짜를 함께 보낼 수 없습니다",
    path: ["endDate"],
  })
  .refine((todo) => todo.endDate == null || todo.endDate >= todo.startDate, {
    error: "종료 날짜는 시작 날짜 이후여야 합니다",
    path: ["endDate"],
  });

export type ApplyTodoAction = z.infer<typeof applyTodoActionSchema>;

export const applyActionSchema = z.discriminatedUnion("type", [
  applyTodoActionSchema,
  plannedMemoActionSchema,
]);

export type ApplyAction = z.infer<typeof applyActionSchema>;

export const applyActionPlanRequestSchema = z.object({
  source: z.enum(ACTION_PLAN_SOURCES).describe("계획을 만든 흐름"),
  actions: z
    .array(applyActionSchema)
    .min(1, "저장할 행동을 하나 이상 골라주세요")
    .max(ACTION_PLAN_LIMITS.MAX_TODOS + ACTION_PLAN_LIMITS.MAX_MEMOS)
    .refine(
      (actions) =>
        actions.filter((action) => action.type === "CREATE_TODO").length <=
        ACTION_PLAN_LIMITS.MAX_TODOS,
      { error: `할 일은 최대 ${ACTION_PLAN_LIMITS.MAX_TODOS}개까지 저장할 수 있습니다` },
    )
    .refine(
      (actions) =>
        actions.filter((action) => action.type === "CREATE_MEMO").length <=
        ACTION_PLAN_LIMITS.MAX_MEMOS,
      { error: `메모는 최대 ${ACTION_PLAN_LIMITS.MAX_MEMOS}개까지 저장할 수 있습니다` },
    )
    .refine((actions) => new Set(actions.map((action) => action.key)).size === actions.length, {
      error: "행동 key가 겹칩니다",
    })
    .describe("사용자가 확인한 행동. 고친 내용을 그대로 저장한다"),
});

export type ApplyActionPlanRequest = z.infer<typeof applyActionPlanRequestSchema>;
