import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import type { Todo } from "../../../shared/domain/todo.aggregate.js";
import type { TodoCachePort } from "../../../todos/application/ports/todo-cache.port.js";
import type { CreatedOccurrence } from "../../../todos/application/ports/todo.repository.port.js";
import { TodoLogEvent } from "../../../todos/application/todos.log-events.js";
import { TodoOccurrencesCreatedEvent } from "../../domain/todo-occurrences-created.event.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";

interface TodoCreationEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class PublishTodoCreationUseCase {
  readonly #dependencies: TodoCreationEffectsDependencies;

  constructor(dependencies: TodoCreationEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async publishSingle(created: Todo, userId: string): Promise<void> {
    this.#dependencies.logger.log({
      event: TodoLogEvent.CREATED,
      todoId: created.getId().getValue(),
      userId,
    });
    await this.#invalidateCaches(userId);
    created.markCreated();
    await this.#dependencies.eventPublisher.publishAll(created.pullDomainEvents());
  }

  async publishSeriesStarted(
    series: TodoSeries,
    occurrences: readonly CreatedOccurrence[],
  ): Promise<void> {
    this.#dependencies.logger.log({
      event: TodoSeriesLogEvent.STARTED,
      seriesId: series.getId(),
      userId: series.getUserId(),
      createdCount: occurrences.length,
    });
    await this.publishOccurrences(series, occurrences);
  }

  /** 커밋 뒤 실행한다. 리마인더는 회차와 함께 커밋됐고 이벤트는 규칙당 하나만 낸다. */
  async publishOccurrences(
    series: TodoSeries,
    occurrences: readonly CreatedOccurrence[],
  ): Promise<void> {
    const userId = series.getUserId();
    await this.#invalidateCaches(userId);
    await this.#dependencies.eventPublisher.publishAll([
      new TodoOccurrencesCreatedEvent(series.getId(), userId, occurrences.length),
    ]);
  }

  async #invalidateCaches(userId: string): Promise<void> {
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);
  }
}
