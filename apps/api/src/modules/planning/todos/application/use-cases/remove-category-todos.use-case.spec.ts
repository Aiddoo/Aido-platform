import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { type RemovedCategoryTodos, TodoBulkRemoverPort } from "../ports/todo-bulk-remover.port.js";
import { RemoveCategoryTodosUseCase } from "./remove-category-todos.use-case.js";

class StubTodoBulkRemover extends TodoBulkRemoverPort {
  readonly #removed: RemovedCategoryTodos;

  constructor(removed: RemovedCategoryTodos) {
    super();
    this.#removed = removed;
  }

  async removeByCategory(): Promise<RemovedCategoryTodos> {
    return this.#removed;
  }
}

function setUp(removed: RemovedCategoryTodos) {
  const reminderScheduler = new RecordingTodoReminderScheduler();
  const todoCache = new FakeTodoCache();
  const afterCommit = new RecordingAfterCommitRegistry();
  const useCase = new RemoveCategoryTodosUseCase({
    bulkRemover: new StubTodoBulkRemover(removed),
    reminderScheduler,
    todoCache,
    afterCommit,
  });
  return { reminderScheduler, todoCache, afterCommit, useCase };
}

const COMMAND = {
  userId: UserId.reconstitute(TODO_FIXTURE_USER_ID),
  categoryId: TodoCategoryId.reconstitute(1),
};

describe("카테고리 할 일 한꺼번에 지우기", () => {
  it("시각이 있던 할 일의 리마인더만 한 번에 지우고 커밋 뒤 친구 화면 캐시를 버린다", async () => {
    // Given
    const { reminderScheduler, todoCache, afterCommit, useCase } = setUp({
      todos: [
        { id: TodoId.reconstitute(10), scheduledTime: TODO_FIXTURE_NOW },
        { id: TodoId.reconstitute(11), scheduledTime: null },
        { id: TodoId.reconstitute(12), scheduledTime: TODO_FIXTURE_NOW },
      ],
      seriesCount: 2,
    });

    // When
    const result = await useCase.execute(COMMAND);
    await afterCommit.runAll();

    // Then
    expect(result).toEqual({ todoCount: 3, seriesCount: 2 });
    expect(reminderScheduler.cancelled).toEqual([10, 12]);
    expect(todoCache.generations.get(TODO_FIXTURE_USER_ID)).toBe(1);
  });

  it("지운 할 일이 없으면 리마인더 취소도 커밋 뒤 작업도 없다", async () => {
    // Given
    const { reminderScheduler, afterCommit, useCase } = setUp({ todos: [], seriesCount: 1 });

    // When
    const result = await useCase.execute(COMMAND);

    // Then
    expect(result).toEqual({ todoCount: 0, seriesCount: 1 });
    expect(reminderScheduler.cancelled).toEqual([]);
    expect(afterCommit.tasks).toEqual([]);
  });
});
