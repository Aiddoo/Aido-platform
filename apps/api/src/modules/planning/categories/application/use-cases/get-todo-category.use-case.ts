import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import { todoCategoryNotFound, todoCategoryNotOwned } from "../categories.errors.js";
import type { TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";
import type { TodoCategoryWithCountReadModel } from "../read-models/todo-category-with-count.read-model.js";

interface GetTodoCategoryDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "findByIdWithCount">;
}

export class GetTodoCategoryUseCase {
  readonly #dependencies: GetTodoCategoryDependencies;

  constructor(dependencies: GetTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly id: number;
    readonly userId: string;
  }): Promise<TodoCategoryWithCountReadModel> {
    const category = await this.#dependencies.repository.findByIdWithCount(
      TodoCategoryId.reconstitute(input.id),
    );
    if (category == null) {
      throw todoCategoryNotFound(TodoCategoryId.reconstitute(input.id));
    }
    if (category.userId !== input.userId) {
      throw todoCategoryNotOwned(TodoCategoryId.reconstitute(input.id));
    }
    return category;
  }
}
