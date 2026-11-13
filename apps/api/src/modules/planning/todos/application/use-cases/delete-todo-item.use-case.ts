import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { TodoItemId } from "../../../shared/domain/todo-item-id.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface DeleteTodoItemInput {
  readonly todoId: number;
  readonly itemId: number;
  readonly userId: string;
}

interface DeleteTodoItemDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "deleteItem">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class DeleteTodoItemUseCase {
  readonly #dependencies: DeleteTodoItemDependencies;

  constructor(dependencies: DeleteTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoItemInput): Promise<TodoReadModel> {
    const { todoId, itemId, userId } = input;
    const targetTodoId = TodoId.reconstitute(todoId);
    const ownerId = UserId.reconstitute(userId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(targetTodoId, ownerId);
      if (todo == null) {
        throw todoNotFound(todoId);
      }

      todo.removeItem(itemId);

      await this.#dependencies.todoRepository.deleteItem(TodoItemId.reconstitute(itemId));
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.ITEM_DELETED,
      todoId,
      itemId,
      userId,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      targetTodoId,
      ownerId,
    );
    if (response == null) {
      throw todoNotFound(todoId);
    }
    return response;
  }
}
