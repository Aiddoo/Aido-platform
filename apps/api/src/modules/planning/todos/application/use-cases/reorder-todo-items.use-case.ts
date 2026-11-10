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

export interface ReorderTodoItemsInput {
  readonly todoId: number;
  readonly userId: string;
  readonly itemIds: number[];
}

interface ReorderTodoItemsDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "reorderItems">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class ReorderTodoItemsUseCase {
  readonly #dependencies: ReorderTodoItemsDependencies;

  constructor(dependencies: ReorderTodoItemsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoItemsInput): Promise<TodoReadModel> {
    const { todoId, userId, itemIds } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      todo.validateItemsReorder(itemIds);

      await this.#dependencies.todoRepository.reorderItems(itemIds);
    });

    this.#dependencies.logger.log({ event: TodoLogEvent.ITEMS_REORDERED, todoId, userId });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
