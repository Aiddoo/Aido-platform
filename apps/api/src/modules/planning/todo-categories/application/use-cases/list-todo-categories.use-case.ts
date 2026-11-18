import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

interface GetTodoCategoriesDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "findManyByUserId">;
  readonly cache: Pick<TodoCategoryCachePort, "wrapList">;
}

export class ListTodoCategoriesUseCase {
  readonly #dependencies: GetTodoCategoriesDependencies;

  constructor(dependencies: GetTodoCategoriesDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: { readonly userId: string }): Promise<TodoCategoryWithCountReadModel[]> {
    const userId = UserId.reconstitute(input.userId);
    return this.#dependencies.cache.wrapList(userId, () =>
      this.#dependencies.repository.findManyByUserId(userId),
    );
  }
}
