import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryCountReaderPort } from "../../application/ports/todo-category-count.reader.port.js";
import type { TodoCategoryReaderPort } from "../../application/ports/todo-category.reader.port.js";
import { type TodoCategoryRepositoryPort } from "../../application/ports/todo-category.repository.port.js";
import type { TodoCategoryWithCountReadModel } from "../../application/read-models/todo-category-with-count.read-model.js";
import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";

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

  listForUser(userId: UserId): Promise<TodoCategoryWithCountReadModel[]> {
    return this.#dependencies.repository.findManyByUserId(userId);
  }

  countCategories(userId: UserId): Promise<number> {
    return this.#dependencies.repository.countByUserId(userId);
  }

  async validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void> {
    const category = await this.#dependencies.repository.findByIdAndUserId(categoryId, userId);
    if (category == null) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
        categoryId: categoryId.value,
      });
    }
  }
}
