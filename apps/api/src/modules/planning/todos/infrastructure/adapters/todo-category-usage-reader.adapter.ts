import { Injectable } from "@nestjs/common";

import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryUsageReaderPort } from "../../application/ports/todo-category-usage.reader.port.js";
import { TodoRepositoryPort } from "../../application/ports/todo.repository.port.js";

@Injectable()
export class TodoCategoryUsageReaderAdapter implements TodoCategoryUsageReaderPort {
  readonly #todoRepository: Pick<TodoRepositoryPort, "countCategoryUsages">;

  constructor(todoRepository: TodoRepositoryPort) {
    this.#todoRepository = todoRepository;
  }

  countUsages(
    userId: UserId,
    categoryIds: readonly TodoCategoryId[],
  ): Promise<ReadonlyMap<number, number>> {
    return this.#todoRepository.countCategoryUsages(userId, categoryIds);
  }
}
