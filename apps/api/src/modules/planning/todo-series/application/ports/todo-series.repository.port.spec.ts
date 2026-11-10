import { describeTodoSeriesRepositoryContract } from "#test/contracts/planning/todo-series-repository.contract";
import { InMemoryTodoSeriesRepository } from "#test/doubles/planning/in-memory-todo-series.repository";
import { TODO_FIXTURE_CATEGORY_ID } from "#test/fixtures/planning/todo.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoSeriesRepositoryContract(async () => ({
  seriesRepository: new InMemoryTodoSeriesRepository(),
  categoryId: TODO_FIXTURE_CATEGORY_ID,
}));
