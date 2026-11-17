import { TodoBuilder } from "#test/builders/index";
import { describeTodoCategoryRepositoryContract } from "#test/contracts/planning/todo-category-repository.contract";
import { InMemoryTodoCategoryRepository } from "#test/doubles/planning/in-memory-todo-category.repository";
import { TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoCategoryRepositoryContract(async () => {
  const todoRecords = new Map<number, PlanningTodoRecord>();
  return {
    categoryRepository: new InMemoryTodoCategoryRepository([], {
      todoRecords,
      seriesStore: new Map(),
    }),
    async seedTodo(categoryId, options) {
      const id = todoRecords.size + 1;
      const record = TodoBuilder.create(TODO_FIXTURE_USER_ID)
        .withId(id)
        .withCategoryId(categoryId)
        .build();
      todoRecords.set(id, { ...record, completed: options?.completed ?? false });
    },
  };
});
