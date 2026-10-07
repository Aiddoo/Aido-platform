import type { ReorderPosition, Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
} from "../../../domain/policies/todos/reorder-position.policy.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

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
  readonly logger: ApplicationLogger;
}

export class ReorderTodo {
  readonly #dependencies: ReorderTodoDependencies;

  constructor(dependencies: ReorderTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoInput): Promise<TodoResponse> {
    const { id, userId, targetTodoId, position } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoSortOrder(userId),
        MutationLockKeys.todo(id),
        ...(targetTodoId === undefined ? [] : [MutationLockKeys.todo(targetTodoId)]),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      if (targetTodoId === id) {
        return;
      }

      let plan: ReorderPlan;
      if (targetTodoId !== undefined) {
        const targetTodo = await this.#dependencies.todoRepository.findByIdAndUserId(
          targetTodoId,
          userId,
        );
        if (targetTodo === null) {
          throw new ApplicationException(ErrorCode.TODO_0810, {
            targetTodoId,
          });
        }
        plan = planReorderRelativeTo(todo.getSortOrder(), targetTodo.getSortOrder(), position);
      } else {
        const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(userId);
        plan = planReorderToEdge(todo.getSortOrder(), position, maxSortOrder);
      }

      await this.#dependencies.todoRepository.shiftSortOrders(
        userId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      await this.#dependencies.todoRepository.updateSortOrder(id, plan.newSortOrder);

      this.#dependencies.logger.log({
        event: PlanningTodoLogEvent.REORDERED,
        todoId: id,
        userId,
        sortOrder: plan.newSortOrder,
      });
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
