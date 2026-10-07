import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { TodoCategoryReaderPort } from "../../ports/categories/todo-category-reader.port.js";
import {
  type TodoCategoryRepositoryPort,
  type TodoCategoryWithCountView,
} from "../../ports/categories/todo-category.repository.port.js";

interface TodoCategoryReaderDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "findManyByUserId" | "findByIdAndUserId">;
}

export class TodoCategoryReader implements TodoCategoryReaderPort {
  readonly #dependencies: TodoCategoryReaderDependencies;

  constructor(dependencies: TodoCategoryReaderDependencies) {
    this.#dependencies = dependencies;
  }

  listForUser(userId: string): Promise<TodoCategoryWithCountView[]> {
    return this.#dependencies.repository.findManyByUserId(userId);
  }

  async validateOwnership(id: number, userId: string): Promise<void> {
    const category = await this.#dependencies.repository.findByIdAndUserId(id, userId);
    if (category === null) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
        categoryId: id,
      });
    }
  }
}
