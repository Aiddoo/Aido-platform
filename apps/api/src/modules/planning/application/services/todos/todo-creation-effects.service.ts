import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import type { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import type { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { TodoOccurrencesCreatedEvent } from "../../../domain/events/series/todo-occurrences-created.event.js";
import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import type { TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import type { CreatedOccurrence } from "../../ports/todos/todo.repository.port.js";

interface TodoCreationEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class TodoCreationEffects {
  readonly #dependencies: TodoCreationEffectsDependencies;

  constructor(dependencies: TodoCreationEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async publishSingle(created: Todo, userId: string): Promise<void> {
    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.CREATED,
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
      event: PlanningTodoSeriesLogEvent.STARTED,
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
