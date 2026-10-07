import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  TodoCategoryRepositoryPort,
  TodoCategoryWithCountView,
} from "../../ports/categories/todo-category.repository.port.js";

interface GetTodoCategoryDependencies {
  readonly repository: Pick<TodoCategoryRepositoryPort, "findByIdWithCount">;
}

export class GetTodoCategory {
  readonly #dependencies: GetTodoCategoryDependencies;

  constructor(dependencies: GetTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    readonly id: number;
    readonly userId: string;
  }): Promise<TodoCategoryWithCountView> {
    const category = await this.#dependencies.repository.findByIdWithCount(input.id);
    if (category === null) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: input.id });
    }
    if (category.userId !== input.userId) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0852, { categoryId: input.id });
    }
    return category;
  }
}
