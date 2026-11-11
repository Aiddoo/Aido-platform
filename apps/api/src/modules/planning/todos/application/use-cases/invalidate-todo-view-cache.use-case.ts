import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

interface TodoViewCacheInvalidatorDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findOwnerId">;
  readonly cache: Pick<TodoCachePort, "invalidateFriendTodos">;
}

export class InvalidateTodoViewCacheUseCase {
  readonly #dependencies: TodoViewCacheInvalidatorDependencies;

  constructor(dependencies: TodoViewCacheInvalidatorDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(todoId: TodoId): Promise<void> {
    const ownerUserId = await this.#dependencies.todoReadRepository.findOwnerId(todoId);

    if (ownerUserId == null) {
      return;
    }

    await this.#dependencies.cache.invalidateFriendTodos(UserId.reconstitute(ownerUserId));
  }
}
