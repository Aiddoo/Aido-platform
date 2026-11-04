import type { Todo } from "@aido/api";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

import type { CreateTodoData } from "../../models/todos/todo.types.js";

export const STAGED_TODO_CREATOR = Symbol("STAGED_TODO_CREATOR");

export interface StagedTodoCreation {
  readonly todos: readonly Todo[];
  readonly afterCommit: AfterCommitTask;
}

/**
 * 다른 Context가 쓰는 유일한 할 일 생성 경로.
 * 활성 UoW와 생성 잠금(todoCategory·todoSortOrder) 안에서 호출하고, 돌려받은 afterCommit은
 * 커밋 뒤에만 실행되도록 등록한다. 롤백되면 알림·캐시 효과가 남지 않는다.
 */
export interface StagedTodoCreatorPort {
  stage(input: CreateTodoData): Promise<StagedTodoCreation>;
}
