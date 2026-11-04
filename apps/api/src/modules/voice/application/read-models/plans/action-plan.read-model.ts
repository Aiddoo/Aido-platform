import type { ActionPlan, ActionPlanMeta, PlannedAction } from "@aido/api";

import type {
  GeneratedActionPlan,
  PlanGenerationMeta,
} from "#api/modules/ai-assistance/ai-assistance-planning.public";

import {
  type ExistingTodo,
  findDuplicateTodoId,
} from "../../../domain/policies/plans/action-plan-dedupe.policy.js";

/** 계획 응답. 행동 key는 응답마다 앱이 선택·편집 상태를 묶는 값이라 순서로 만든다. */
export function toActionPlanView(
  plan: GeneratedActionPlan,
  existingTodos: readonly ExistingTodo[],
): ActionPlan {
  const todos = plan.todos.map((todo, index): PlannedAction => ({
    type: "CREATE_TODO",
    key: `todo-${index}`,
    title: todo.title,
    categoryId: todo.categoryId,
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: todo.scheduledTime,
    repeat: todo.repeat,
    visibility: todo.visibility,
    items: todo.items.map((title) => ({ title })),
    duplicateOfTodoId: findDuplicateTodoId(todo, existingTodos),
  }));
  const memo: PlannedAction[] =
    plan.memo == null
      ? []
      : [
          {
            type: "CREATE_MEMO",
            key: "memo-0",
            title: plan.memo.title,
            content: plan.memo.content,
          },
        ];
  return { actions: [...todos, ...memo], omittedTodoCount: plan.omittedTodoCount };
}

export function toActionPlanMeta(
  meta: PlanGenerationMeta,
  processingTimeMs: number,
): ActionPlanMeta {
  return {
    model: meta.model,
    processingTimeMs,
    tokenUsage: { input: meta.inputTokens, output: meta.outputTokens },
    promptVersion: meta.promptVersion,
  };
}

export function countPlannedActions(plan: ActionPlan) {
  const todos = plan.actions.filter((action) => action.type === "CREATE_TODO");
  return {
    todoCount: todos.length,
    duplicateCount: todos.filter((todo) => todo.duplicateOfTodoId != null).length,
    hasMemo: todos.length < plan.actions.length,
  };
}
