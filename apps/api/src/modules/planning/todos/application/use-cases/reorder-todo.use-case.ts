import { ErrorCode } from "@aido/api/errors";
import type { ReorderPosition } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
} from "../../domain/todo-ordering.domain-service.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface ReorderTodoInput {
  readonly id: number;
  readonly userId: string;
  readonly targetTodoId: number | undefined;
  readonly position: ReorderPosition;
}

interface ReorderTodoDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "getMaxSortOrder" | "shiftSortOrders" | "updateSortOrder"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class ReorderTodoUseCase {
  readonly #dependencies: ReorderTodoDependencies;

  constructor(dependencies: ReorderTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoInput): Promise<TodoReadModel> {
    const { id, userId, targetTodoId, position } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoLockKeys.sortOrder(userId),
        TodoLockKeys.todo(id),
        ...(targetTodoId == null ? [] : [TodoLockKeys.todo(targetTodoId)]),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      if (targetTodoId === id) {
        return;
      }

      let plan: ReorderPlan;
      if (targetTodoId != null) {
        const targetTodo = await this.#dependencies.todoRepository.findByIdAndUserId(
          targetTodoId,
          userId,
        );
        if (targetTodo == null) {
          throw new ApplicationException(ErrorCode.TODO_0810, {
            targetTodoId,
          });
        }
        plan = planReorderRelativeTo(todo.sortOrder, targetTodo.sortOrder, position);
      } else {
        const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(userId);
        plan = planReorderToEdge(todo.sortOrder, position, maxSortOrder);
      }

      await this.#dependencies.todoRepository.shiftSortOrders(
        userId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      await this.#dependencies.todoRepository.updateSortOrder(id, plan.newSortOrder);

      this.#dependencies.logger.log({
        event: TodoLogEvent.REORDERED,
        todoId: id,
        userId,
        sortOrder: plan.newSortOrder,
      });
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
