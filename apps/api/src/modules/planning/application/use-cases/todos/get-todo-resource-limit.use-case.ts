import { TODO_LIMITS } from "@aido/api/vocabulary";

import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

export interface TodoResourceLimitResult {
  readonly activeCount?: number;
  readonly maxPerCategory: number;
}

export interface GetTodoResourceLimitInput {
  readonly userId: string;
  readonly categoryId?: number;
}

interface GetTodoResourceLimitDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "countActiveByCategory">;
}

export class GetTodoResourceLimit {
  readonly #dependencies: GetTodoResourceLimitDependencies;

  constructor(dependencies: GetTodoResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoResourceLimitInput): Promise<TodoResourceLimitResult> {
    if (input.categoryId !== undefined) {
      const activeCount = await this.#dependencies.todoReadRepository.countActiveByCategory(
        input.userId,
        input.categoryId,
      );
      return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
    }
    return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
  }
}
