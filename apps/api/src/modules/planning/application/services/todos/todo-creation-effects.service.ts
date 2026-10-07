import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import type { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import type { TodoCachePort } from "../../ports/todos/todo-cache.port.js";

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
    await this.#publish([created], userId);
  }

  async publishRecurring(
    created: readonly Todo[],
    userId: string,
    recurrenceGroupId: string,
  ): Promise<void> {
    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.RECURRING_CREATED,
      userId,
      recurrenceGroupId,
      todoCount: created.length,
    });
    await this.#publish(created, userId);
  }

  async #publish(created: readonly Todo[], userId: string): Promise<void> {
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);
    const events = created.flatMap((todo) => {
      todo.markCreated();
      return todo.pullDomainEvents();
    });
    await this.#dependencies.eventPublisher.publishAll(events);
  }
}
