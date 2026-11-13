import type { ReorderPosition } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
} from "../../domain/todo-ordering.domain-service.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { reorderTargetTodoNotFound, todoNotFound } from "../todos.errors.js";
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
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoLockKeys.sortOrder(userId),
        TodoLockKeys.todo(id),
        ...(targetTodoId == null ? [] : [TodoLockKeys.todo(targetTodoId)]),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, ownerId);
      if (todo == null) {
        throw todoNotFound(id);
      }

      if (targetTodoId === id) {
        return;
      }

      let plan: ReorderPlan;
      if (targetTodoId != null) {
        const targetTodo = await this.#dependencies.todoRepository.findByIdAndUserId(
          TodoId.reconstitute(targetTodoId),
          ownerId,
        );
        if (targetTodo == null) {
          throw reorderTargetTodoNotFound(targetTodoId);
        }
        plan = planReorderRelativeTo(todo.sortOrder, targetTodo.sortOrder, position);
      } else {
        const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(ownerId);
        plan = planReorderToEdge(todo.sortOrder, position, maxSortOrder);
      }

      await this.#dependencies.todoRepository.shiftSortOrders(
        ownerId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      await this.#dependencies.todoRepository.updateSortOrder(todoId, plan.newSortOrder);

      this.#dependencies.logger.log({
        event: TodoLogEvent.REORDERED,
        todoId: id,
        userId,
        sortOrder: plan.newSortOrder,
      });
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, ownerId);
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }
}
