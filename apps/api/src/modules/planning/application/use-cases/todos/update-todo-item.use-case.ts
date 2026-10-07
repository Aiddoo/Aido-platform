import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

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
  readonly logger: ApplicationLogger;
}

export class UpdateTodoItem {
  readonly #dependencies: UpdateTodoItemDependencies;

  constructor(dependencies: UpdateTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoItemInput): Promise<TodoResponse> {
    const { todoId, itemId, userId, data } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const item = todo.updateItem(itemId, data);

      const snapshot = item.toPersistence();
      const patch: { title?: string; completed?: boolean } = {};
      if (data.title !== undefined) {
        patch.title = snapshot.title;
      }
      if (data.completed !== undefined) {
        patch.completed = snapshot.completed;
      }
      await this.#dependencies.todoRepository.updateItem(itemId, patch);
    });

    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.ITEM_UPDATED,
      todoId,
      itemId,
      userId,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
