import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { todoNotFound } from "#api/modules/planning/todos/planning-todos-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { invalidRepeatRule, todoSeriesLimitReached } from "../todo-series.errors.js";

export interface CheckTodoSeriesStartInput {
  readonly todoId: number;
  readonly userId: string;
}

interface CheckTodoSeriesStartDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId">;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId">;
}

/**
 * 단일 할 일에 반복을 더할 수 있는지 활성 UoW 안에서 먼저 확인한다. 다른 필드와 함께 온 PATCH가 쓰기 전에 거절되게 한다.
 * 이미 반복인 회차의 규칙을 바꾸는 것은 범위를 고른 수정이다.
 */
export class CheckTodoSeriesStartUseCase {
  readonly #dependencies: CheckTodoSeriesStartDependencies;

  constructor(dependencies: CheckTodoSeriesStartDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CheckTodoSeriesStartInput): Promise<void> {
    const { todoId, userId } = input;
    const { todoRepository, seriesRepository } = this.#dependencies;
    const ownerId = UserId.reconstitute(userId);
    const todo = await todoRepository.findByIdAndUserId(TodoId.reconstitute(todoId), ownerId);
    if (todo == null) {
      throw todoNotFound(todoId);
    }
    if (todo.isOccurrence()) {
      throw invalidRepeatRule("scope");
    }
    const activeCount = await seriesRepository.countActiveByUserId(ownerId);
    if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
      throw todoSeriesLimitReached(TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER, activeCount);
    }
  }
}
