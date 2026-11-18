import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { describeTodoRepositoryContract } from "#test/contracts/planning/todo-repository.contract";
import { InMemoryTodoOccurrenceWriter } from "#test/doubles/planning/in-memory-todo-occurrence-writer";
import { InMemoryTodoSeriesRepository } from "#test/doubles/planning/in-memory-todo-series.repository";
import {
  InMemoryTodoRepository,
  InMemoryTodoSequence,
} from "#test/doubles/planning/in-memory-todo.repository";
import type { PlanningTodoRecord } from "#test/fixtures/planning/todo-response.fixture";
import { TODO_FIXTURE_CATEGORY_ID } from "#test/fixtures/planning/todo.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoRepositoryContract(async () => {
  const records = new Map<number, PlanningTodoRecord>();
  const seriesStore = new Map<string, TodoSeries>();
  const sequence = new InMemoryTodoSequence();
  return {
    todoRepository: new InMemoryTodoRepository(records, seriesStore, sequence),
    occurrenceWriter: new InMemoryTodoOccurrenceWriter(records, sequence),
    seriesRepository: new InMemoryTodoSeriesRepository(seriesStore),
    categoryId: TODO_FIXTURE_CATEGORY_ID,
    engagementCounts: {
      async write(todoId, counts) {
        const record = records.get(todoId.value);
        if (record != null) {
          Object.assign(record, counts);
        }
      },
      async read(todoId) {
        const record = records.get(todoId.value);
        return {
          commentCount: record?.commentCount ?? -1,
          viewCount: record?.viewCount ?? -1,
        };
      },
    },
  };
});
