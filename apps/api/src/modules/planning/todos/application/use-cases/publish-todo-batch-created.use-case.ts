import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCachePort } from "../ports/todo-cache.port.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface PublishTodoBatchCreatedCommand {
  readonly userId: UserId;
  readonly count: number;
}

interface PublishTodoBatchCreatedDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 리마인더·planning.todo.created는 행과 함께 커밋됐다. 묶음마다 캐시를 한 번만 비운다
export class PublishTodoBatchCreatedUseCase {
  readonly #dependencies: PublishTodoBatchCreatedDependencies;

  constructor(dependencies: PublishTodoBatchCreatedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: PublishTodoBatchCreatedCommand): Promise<void> {
    this.#dependencies.logger.log({
      event: TodoLogEvent.BATCH_CREATED,
      userId: command.userId.value,
      count: command.count,
    });
    await this.#dependencies.todoCache.invalidateTodoCategories(command.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(command.userId);
  }
}
