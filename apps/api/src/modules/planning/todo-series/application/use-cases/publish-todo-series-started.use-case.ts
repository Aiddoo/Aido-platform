import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import type { TodoCachePort } from "../../../todos/application/ports/todo-cache.port.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";

export interface StartedTodoSeries {
  readonly series: TodoSeries;
  readonly createdCount: number;
}

interface PublishTodoSeriesStartedDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 반복 시작의 커밋 뒤 효과. 리마인더·이벤트는 회차와 함께 커밋됐다. */
export class PublishTodoSeriesStartedUseCase {
  readonly #dependencies: PublishTodoSeriesStartedDependencies;

  constructor(dependencies: PublishTodoSeriesStartedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(started: StartedTodoSeries): Promise<void> {
    const { series, createdCount } = started;
    this.#dependencies.logger.log({
      event: TodoSeriesLogEvent.STARTED,
      seriesId: series.id.value,
      userId: series.userId.value,
      createdCount,
    });
    await this.#dependencies.todoCache.invalidateTodoCategories(series.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(series.userId);
  }
}
