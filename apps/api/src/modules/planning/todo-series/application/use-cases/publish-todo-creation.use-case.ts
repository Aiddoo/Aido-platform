import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import type { Todo, TodoEvent } from "../../../shared/domain/todo.aggregate.js";
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

  /** events는 생성 트랜잭션에서 반영한 사실이다. 옛 todo.* 구독을 위해 커밋 뒤 다시 낸다. */
  async publishSingle(created: Todo, events: readonly TodoEvent[]): Promise<void> {
    const userId = created.userId.value;
    this.#dependencies.logger.log({
      event: TodoLogEvent.CREATED,
      todoId: created.id.value,
      userId,
    });
    await this.#invalidateCaches(userId);
    await this.#dependencies.eventPublisher.publishAll(events);
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
    await this.publishOccurrences(series, occurrences);
  }

  /** 커밋 뒤 실행한다. 리마인더는 회차와 함께 커밋됐고 이벤트는 규칙당 하나만 낸다. */
  async publishOccurrences(
    series: TodoSeries,
    occurrences: readonly CreatedOccurrence[],
  ): Promise<void> {
    const userId = series.userId.value;
    await this.#invalidateCaches(userId);
    await this.#dependencies.eventPublisher.publishAll([
      new TodoOccurrencesCreatedEvent(series.id.value, userId, occurrences.length),
    ]);
  }

  async #invalidateCaches(userId: string): Promise<void> {
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);
  }
}
