import { TODO_LIMITS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

export interface TodoResourceLimitResult {
  readonly activeCount?: number;
  readonly maxPerCategory: number;
}

export interface GetTodoResourceLimitInput {
  readonly userId: string;
  readonly categoryId?: number;
}

interface GetTodoResourceLimitDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "countCategoryUsage">;
}

export class GetTodoResourceLimitUseCase {
  readonly #dependencies: GetTodoResourceLimitDependencies;

  constructor(dependencies: GetTodoResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoResourceLimitInput): Promise<TodoResourceLimitResult> {
    if (input.categoryId != null) {
      const activeCount = await this.#dependencies.todoReadRepository.countCategoryUsage(
        UserId.reconstitute(input.userId),
        TodoCategoryId.reconstitute(input.categoryId),
      );
      return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
    }
    return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
  }
}
