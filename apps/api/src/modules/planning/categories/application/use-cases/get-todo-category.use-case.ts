import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
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
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: input.id });
    }
    if (category.userId !== input.userId) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0852, { categoryId: input.id });
    }
    return category;
  }
}
