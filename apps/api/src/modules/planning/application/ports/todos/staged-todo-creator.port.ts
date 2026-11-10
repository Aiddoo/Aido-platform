import type { Todo, TodoSeriesResponse } from "@aido/api";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

import type { CreateTodoData } from "../../models/todos/todo.types.js";

export const STAGED_TODO_CREATOR = Symbol("STAGED_TODO_CREATOR");

export interface StagedTodoCreation {
  /** 만든 할 일. 반복이면 회차를 날짜순으로 담고 맨 앞이 첫 회차다. */
  readonly todos: readonly Todo[];
  /** 반복으로 만들었을 때의 규칙. 단일 할 일은 null이다. */
  readonly series: TodoSeriesResponse | null;
  readonly afterCommit: AfterCommitTask;
}

/**
 * 다른 Context가 쓰는 유일한 할 일 생성 경로.
 * 활성 UoW와 생성 잠금(todoCategory·todoSortOrder) 안에서 호출하고, 돌려받은 afterCommit은
 * 커밋 뒤에만 실행되도록 등록한다. 롤백되면 알림·캐시 효과가 남지 않는다.
 */
export abstract class StagedTodoCreatorPort {
  abstract stage(input: CreateTodoData): Promise<StagedTodoCreation>;
}
