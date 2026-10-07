import { TODO_LIMITS } from "@aido/api/vocabulary";

import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

export interface TodoResourceLimitResult {
  activeCount?: number;
  maxPerCategory: number;
}

/** 카테고리당 활성 Todo 리소스 제한 정보 조회 입력. */
export interface GetTodoResourceLimitInput {
  userId: string;
  categoryId?: number;
}

interface GetTodoResourceLimitDependencies {
  readonly todoReadRepository: TodoReadRepositoryPort;
}

export class GetTodoResourceLimit {
  readonly #dependencies: GetTodoResourceLimitDependencies;

  constructor(dependencies: GetTodoResourceLimitDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoResourceLimitInput): Promise<TodoResourceLimitResult> {
    if (input.categoryId) {
      const activeCount = await this.#dependencies.todoReadRepository.countActiveByCategory(
        input.userId,
        input.categoryId,
      );
      return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
    }
    return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
  }
}
