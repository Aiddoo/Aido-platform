import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { TodoCategoryCountReaderPort } from "../../application/ports/todo-category-count.reader.port.js";
import type { TodoCategoryReaderPort } from "../../application/ports/todo-category.reader.port.js";
import {
  type TodoCategoryRepositoryPort,
  type TodoCategoryWithCountView,
} from "../../application/ports/todo-category.repository.port.js";

interface TodoCategoryReaderDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findManyByUserId" | "findByIdAndUserId" | "countByUserId"
  >;
}

export class TodoCategoryReaderAdapter
  implements TodoCategoryReaderPort, TodoCategoryCountReaderPort
{
  readonly #dependencies: TodoCategoryReaderDependencies;

  constructor(dependencies: TodoCategoryReaderDependencies) {
    this.#dependencies = dependencies;
  }

  listForUser(userId: string): Promise<TodoCategoryWithCountView[]> {
    return this.#dependencies.repository.findManyByUserId(userId);
  }

  countCategories(userId: string): Promise<number> {
    return this.#dependencies.repository.countByUserId(userId);
  }

  async validateOwnership(id: number, userId: string): Promise<void> {
    const category = await this.#dependencies.repository.findByIdAndUserId(id, userId);
    if (category == null) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
        categoryId: id,
      });
    }
  }
}
