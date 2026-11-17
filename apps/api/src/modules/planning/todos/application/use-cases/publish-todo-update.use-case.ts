import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { AppliedTodoUpdate } from "./apply-todo-update.use-case.js";

interface PublishTodoUpdateDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 할 일 수정의 커밋 뒤 효과. */
export class PublishTodoUpdateUseCase {
  readonly #dependencies: PublishTodoUpdateDependencies;

  constructor(dependencies: PublishTodoUpdateDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(applied: AppliedTodoUpdate): Promise<void> {
    const { id, userId, hasCategoryChanged } = applied;
    this.#dependencies.logger.log({ event: TodoLogEvent.UPDATED, todoId: id, userId });

    const ownerId = UserId.reconstitute(userId);
    if (hasCategoryChanged) {
      await this.#dependencies.todoCache.invalidateTodoCategories(ownerId);
    }
    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);
  }
}
