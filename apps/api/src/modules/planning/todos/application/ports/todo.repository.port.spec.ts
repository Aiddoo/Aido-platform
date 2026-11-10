import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { describeTodoRepositoryContract } from "#test/contracts/planning/todo-repository.contract";
import { InMemoryTodoSeriesRepository } from "#test/doubles/planning/in-memory-todo-series.repository";
import { InMemoryTodoRepository } from "#test/doubles/planning/in-memory-todo.repository";
import { TODO_FIXTURE_CATEGORY_ID } from "#test/fixtures/planning/todo.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoRepositoryContract(async () => {
  const seriesStore = new Map<string, TodoSeries>();
  return {
    todoRepository: new InMemoryTodoRepository(new Map(), seriesStore),
    seriesRepository: new InMemoryTodoSeriesRepository(seriesStore),
    categoryId: TODO_FIXTURE_CATEGORY_ID,
  };
});
