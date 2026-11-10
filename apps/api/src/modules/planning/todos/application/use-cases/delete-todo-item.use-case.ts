import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
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

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      todo.removeItem(itemId);

      await this.#dependencies.todoRepository.deleteItem(itemId);
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.ITEM_DELETED,
      todoId,
      itemId,
      userId,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
