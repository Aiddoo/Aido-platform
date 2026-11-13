import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

interface TodoViewCacheInvalidatorDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findOwnerIds">;
  readonly cache: Pick<TodoCachePort, "invalidateFriendTodos">;
}

export class InvalidateTodoViewCacheUseCase {
  readonly #dependencies: TodoViewCacheInvalidatorDependencies;

  constructor(dependencies: TodoViewCacheInvalidatorDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(todoIds: readonly TodoId[]): Promise<void> {
    const ownerUserIds = await this.#dependencies.todoReadRepository.findOwnerIds(todoIds);
    // 한 소유자의 캐시 장애가 다른 소유자 정리를 막지 않게 모두 시도하고 첫 실패를 알린다
    const settled = await Promise.allSettled(
      ownerUserIds.map((ownerUserId) =>
        this.#dependencies.cache.invalidateFriendTodos(UserId.reconstitute(ownerUserId)),
      ),
    );
    const failure = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure != null) {
      throw failure.reason;
    }
  }
}
