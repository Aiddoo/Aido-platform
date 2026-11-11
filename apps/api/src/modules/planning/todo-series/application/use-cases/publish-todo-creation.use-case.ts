import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { Todo } from "../../../shared/domain/todo.aggregate.js";
import type { TodoCachePort } from "../../../todos/application/ports/todo-cache.port.js";
import type { CreatedOccurrence } from "../../../todos/application/ports/todo.repository.port.js";
import { TodoLogEvent } from "../../../todos/application/todos.log-events.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";

interface TodoCreationEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class PublishTodoCreationUseCase {
  readonly #dependencies: TodoCreationEffectsDependencies;

  constructor(dependencies: TodoCreationEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async publishSingle(created: Todo): Promise<void> {
    const userId = created.userId.value;
    this.#dependencies.logger.log({
      event: TodoLogEvent.CREATED,
      todoId: created.id.value,
      userId,
    });
    await this.#invalidateCaches(created.userId);
  }

  async publishSeriesStarted(
    series: TodoSeries,
    occurrences: readonly CreatedOccurrence[],
  ): Promise<void> {
    this.#dependencies.logger.log({
      event: TodoSeriesLogEvent.STARTED,
      seriesId: series.id.value,
      userId: series.userId.value,
      createdCount: occurrences.length,
    });
    await this.publishOccurrences(series);
  }

  /** 커밋 뒤 실행한다. 리마인더·이벤트는 회차와 함께 커밋됐다. */
  async publishOccurrences(series: TodoSeries): Promise<void> {
    await this.#invalidateCaches(series.userId);
  }

  async #invalidateCaches(userId: UserId): Promise<void> {
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);
  }
}
