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
  readonly logger: ApplicationLogger;
}

export class ReorderTodoItems {
  readonly #dependencies: ReorderTodoItemsDependencies;

  constructor(dependencies: ReorderTodoItemsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoItemsInput): Promise<TodoResponse> {
    const { todoId, userId, itemIds } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      todo.validateItemsReorder(itemIds);

      await this.#dependencies.todoRepository.reorderItems(itemIds);
    });

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.ITEMS_REORDERED, todoId, userId });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
