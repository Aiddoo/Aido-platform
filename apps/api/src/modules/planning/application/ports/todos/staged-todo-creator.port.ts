import type { Todo } from "@aido/api";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

import type { CreateTodoData, CreateRecurringTodoData } from "../../models/todos/todo.types.js";

export const STAGED_TODO_CREATOR = Symbol("STAGED_TODO_CREATOR");

export interface StagedTodoCreation {
  readonly todos: readonly Todo[];
  readonly afterCommit: AfterCommitTask;
}

/** 활성 UoW와 생성 잠금 안에서 호출하며, 성공한 항목의 afterCommit만 커밋 후 등록한다. */
export interface StagedTodoCreatorPort {
  stageTodo(input: CreateTodoData): Promise<StagedTodoCreation>;
  stageRecurringTodos(
    input: CreateRecurringTodoData,
    timezone: string,
  ): Promise<StagedTodoCreation>;
}
