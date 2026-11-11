import type { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import {
  type RemovedCategoryTodos,
  type RemovedTodo,
  TodoBulkRemoverPort,
} from "#api/modules/planning/todos/application/ports/todo-bulk-remover.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryPlanningStores } from "./in-memory-todo-category.repository.js";

// 카테고리 대역(InMemoryTodoCategoryRepository)과 같은 planning 기록을 지운다
export class InMemoryTodoBulkRemover extends TodoBulkRemoverPort {
  readonly #stores: InMemoryPlanningStores;

  constructor(stores: InMemoryPlanningStores) {
    super();
    this.#stores = stores;
  }

  async removeByCategory(
    userId: UserId,
    categoryId: TodoCategoryId,
  ): Promise<RemovedCategoryTodos> {
    const todos: RemovedTodo[] = [];
    for (const [id, record] of this.#stores.todoRecords) {
      if (record.userId === userId.value && record.categoryId === categoryId.value) {
        this.#stores.todoRecords.delete(id);
        todos.push({ id: TodoId.reconstitute(id), scheduledTime: record.scheduledTime });
      }
    }
    let seriesCount = 0;
    for (const [id, series] of this.#stores.seriesStore) {
      if (series.userId.equals(userId) && series.categoryId === categoryId.value) {
        this.#stores.seriesStore.delete(id);
        seriesCount += 1;
      }
    }
    return { todos, seriesCount };
  }
}
