import type { TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import type {
  TodoCategoryRepositoryPort,
  TodoCategoryWithCountView,
} from "../../ports/categories/todo-category.repository.port.js";

interface GetTodoCategoriesDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "findManyByUserId">;
  readonly cache: Pick<TodoCategoryCachePort, "wrapList">;
}

export class GetTodoCategories {
  readonly #dependencies: GetTodoCategoriesDependencies;

  constructor(dependencies: GetTodoCategoriesDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: { readonly userId: string }): Promise<TodoCategoryWithCountView[]> {
    return this.#dependencies.cache.wrapList(input.userId, () =>
      this.#dependencies.repository.findManyByUserId(input.userId),
    );
  }
}
