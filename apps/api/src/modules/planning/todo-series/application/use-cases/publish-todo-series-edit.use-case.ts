import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import type { TodoCachePort } from "../../../todos/application/ports/todo-cache.port.js";

export interface TodoSeriesEditEffect {
  readonly seriesId: string;
  readonly userId: string;
}

interface TodoSeriesEditEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 범위 수정·삭제의 커밋 뒤 캐시 정리. 리마인더·이벤트는 UoW 안에서 처리한다. */
export class PublishTodoSeriesEditUseCase {
  readonly #dependencies: TodoSeriesEditEffectsDependencies;

  constructor(dependencies: TodoSeriesEditEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(effect: TodoSeriesEditEffect): Promise<void> {
    const { todoCache } = this.#dependencies;
    await todoCache.invalidateTodoCategories(effect.userId);
    await todoCache.invalidateFriendTodos(effect.userId);
  }
}
