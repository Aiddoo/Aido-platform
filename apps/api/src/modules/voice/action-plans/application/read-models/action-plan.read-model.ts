import type { TodoVisibility } from "@aido/api/vocabulary";

import {
  type ExistingTodo,
  findDuplicateTodoId,
  type GeneratedActionPlan,
} from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";

type GeneratedTodo = GeneratedActionPlan["todos"][number];

interface PlannedTodoReadModel {
  readonly type: "CREATE_TODO";
  readonly key: string;
  readonly title: string;
  /** AI가 고르지 못했으면 null이다. 앱이 현재 카테고리를 넣어 적용 API로 보낸다 */
  readonly categoryId: number | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly repeat: GeneratedTodo["repeat"];
  readonly visibility: TodoVisibility | null;
  readonly items: readonly { readonly title: string }[];
  readonly duplicateOfTodoId: number | null;
}

interface PlannedMemoReadModel {
  readonly type: "CREATE_MEMO";
  readonly key: string;
  readonly title: string;
  readonly content: string;
}

type PlannedActionReadModel = PlannedTodoReadModel | PlannedMemoReadModel;

/** 사용자에게 보여 줄 계획. 서버는 저장하지 않고 사용자가 확인한 행동만 적용 API로 받는다 */
export interface ActionPlanReadModel {
  readonly actions: readonly PlannedActionReadModel[];
  readonly omittedTodoCount: number;
}

/** 행동 key는 응답마다 앱이 선택·편집 상태를 묶는 값이라 순서로 만든다. */
export function toActionPlanReadModel(
  plan: GeneratedActionPlan,
  existingTodos: readonly ExistingTodo[],
): ActionPlanReadModel {
  const todos = plan.todos.map((todo, index): PlannedTodoReadModel => ({
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
  const memo: PlannedMemoReadModel[] =
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

export function countPlannedActions(plan: ActionPlanReadModel) {
  const todos = plan.actions.filter((action) => action.type === "CREATE_TODO");
  return {
    todoCount: todos.length,
    duplicateCount: todos.filter((todo) => todo.duplicateOfTodoId != null).length,
    hasMemo: todos.length < plan.actions.length,
  };
}
