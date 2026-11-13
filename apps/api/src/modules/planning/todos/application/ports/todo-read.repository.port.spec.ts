import type { Todo as TodoResponse } from "@aido/api";

import { describeTodoReadRepositoryContract } from "#test/contracts/planning/todo-read-repository.contract";
import { InMemoryTodoReadRepository } from "#test/doubles/planning/in-memory-todo-read.repository";
import { InMemoryTodoRepository } from "#test/doubles/planning/in-memory-todo.repository";
import { TODO_FIXTURE_CATEGORY_ID } from "#test/fixtures/planning/todo.fixture";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoReadRepositoryContract(async () => {
  const records = new Map<number, PlanningTodoRecord>();
  return {
    todoRepository: new InMemoryTodoRepository(records),
    todoReadRepository: new InMemoryTodoReadRepository(
      records,
      new Map<number, TodoResponse["category"]>(),
    ),
    categoryId: TODO_FIXTURE_CATEGORY_ID,
  };
});
