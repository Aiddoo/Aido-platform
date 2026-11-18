import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import type { Todo } from "../../domain/todo.aggregate.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import { TodoLogEvent } from "../todos.log-events.js";

interface PublishTodoCreatedDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 단일 할 일 만들기의 커밋 뒤 효과. 리마인더·이벤트는 행과 함께 커밋됐다. */
export class PublishTodoCreatedUseCase {
  readonly #dependencies: PublishTodoCreatedDependencies;

  constructor(dependencies: PublishTodoCreatedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(created: Todo): Promise<void> {
    this.#dependencies.logger.log({
      event: TodoLogEvent.CREATED,
      todoId: created.id.value,
      userId: created.userId.value,
    });
    await this.#dependencies.todoCache.invalidateTodoCategories(created.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(created.userId);
  }
}
