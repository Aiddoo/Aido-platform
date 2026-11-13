import type { ReorderPosition } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { Todo } from "../../../shared/domain/todo.aggregate.js";
import {
  planReorderRelativeTo,
  planReorderToEdge,
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
    | "findByIdAndUserId"
    | "findAdjacentSortOrder"
    | "findEdgeSortOrder"
    | "renumberSortOrders"
    | "updateSortOrder"
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

      const target = targetTodoId == null ? null : await this.#findTarget(targetTodoId, ownerId);

      // 이웃 사이 값 한 행만 쓰고, 사이가 없을 때만 그 사용자 순서를 간격 있게 다시 매긴 뒤 다시 계산한다
      let sortOrder = await this.#planSortOrder(ownerId, todoId, target, position);
      if (sortOrder == null) {
        await this.#dependencies.todoRepository.renumberSortOrders(ownerId);
        // 다시 매기면 기준 할 일의 값도 바뀐다
        const renumberedTarget =
          targetTodoId == null ? null : await this.#findTarget(targetTodoId, ownerId);
        sortOrder = await this.#planSortOrder(ownerId, todoId, renumberedTarget, position);
      }
      if (sortOrder == null) {
        throw new Error("todo sortOrder has no room after renumbering");
      }
      await this.#dependencies.todoRepository.updateSortOrder(todoId, sortOrder);

      this.#dependencies.logger.log({
        event: TodoLogEvent.REORDERED,
        todoId: id,
        userId,
        sortOrder,
      });
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, ownerId);
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }

  async #findTarget(targetTodoId: number, ownerId: UserId): Promise<Todo> {
    const target = await this.#dependencies.todoRepository.findByIdAndUserId(
      TodoId.reconstitute(targetTodoId),
      ownerId,
    );
    if (target == null) {
      throw reorderTargetTodoNotFound(targetTodoId);
    }
    return target;
  }

  async #planSortOrder(
    ownerId: UserId,
    todoId: TodoId,
    target: Todo | null,
    position: ReorderPosition,
  ): Promise<number | null> {
    const { todoRepository } = this.#dependencies;
    if (target == null) {
      const edge = await todoRepository.findEdgeSortOrder(
        ownerId,
        position === "before" ? "first" : "last",
        todoId,
      );
      return planReorderToEdge(position, edge);
    }
    const beyond = await todoRepository.findAdjacentSortOrder(
      ownerId,
      { id: target.id, sortOrder: target.sortOrder },
      position === "before" ? "previous" : "next",
      todoId,
    );
    return planReorderRelativeTo(position, { target: target.sortOrder, beyond });
  }
}
