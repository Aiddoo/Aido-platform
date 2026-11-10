import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface UpdateTodoItemInput {
  readonly todoId: number;
  readonly itemId: number;
  readonly userId: string;
  readonly data: { title?: string; completed?: boolean };
}

interface UpdateTodoItemDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateItem">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoItemUseCase {
  readonly #dependencies: UpdateTodoItemDependencies;

  constructor(dependencies: UpdateTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoItemInput): Promise<TodoResponse> {
    const { todoId, itemId, userId, data } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const item = todo.updateItem(itemId, data);

      const snapshot = item.toPersistence();
      const patch: { title?: string; completed?: boolean } = {};
      if (data.title != null) {
        patch.title = snapshot.title;
      }
      if (data.completed != null) {
        patch.completed = snapshot.completed;
      }
      await this.#dependencies.todoRepository.updateItem(itemId, patch);
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.ITEM_UPDATED,
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
