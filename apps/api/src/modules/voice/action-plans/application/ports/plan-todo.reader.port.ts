import type { Todo } from "@aido/api";

/** 이미 적용한 계획의 결과를 다시 돌려줄 때 만든 할 일을 읽는다. */
export interface PlanTodoReaderPort {
  findManyByIds(userId: string, ids: readonly number[]): Promise<Todo[]>;
}
