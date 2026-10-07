import type { TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoViewCacheInvalidatorPort } from "../../ports/todos/todo-view-cache-invalidator.port.js";

interface TodoViewCacheInvalidatorDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findOwnerId">;
  readonly cache: Pick<TodoCachePort, "invalidateFriendTodos">;
}

export class TodoViewCacheInvalidator implements TodoViewCacheInvalidatorPort {
  readonly #dependencies: TodoViewCacheInvalidatorDependencies;

  constructor(dependencies: TodoViewCacheInvalidatorDependencies) {
    this.#dependencies = dependencies;
  }

  async invalidateForTodo(todoId: number): Promise<void> {
    const ownerUserId = await this.#dependencies.todoReadRepository.findOwnerId(todoId);

    if (ownerUserId === null) {
      return;
    }

    await this.#dependencies.cache.invalidateFriendTodos(ownerUserId);
  }
}
