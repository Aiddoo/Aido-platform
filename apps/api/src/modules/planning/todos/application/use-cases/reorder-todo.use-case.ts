import type { ReorderPosition } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import {
  planReorderRelativeTo,
  planReorderToEdge,
} from "../../domain/todo-ordering.domain-service.js";
import type { Todo } from "../../domain/todo.aggregate.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import {
  reorderTargetTodoNotFound,
  todoNotFound,
  todoSortOrderExhausted,
} from "../todos.errors.js";
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
    | "lockByIdAndUserId"
    | "findAdjacentSortOrder"
    | "findEdgeSortOrder"
    | "renumberSortOrders"
    | "save"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
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
      let todo = await this.#lockTodo(todoId, ownerId);
      if (targetTodoId === id) {
        return;
      }

      const target = targetTodoId == null ? null : await this.#findTarget(targetTodoId, ownerId);

      // 이웃 사이 값 한 행만 쓰고, 사이가 없을 때만 그 사용자 순서를 간격 있게 다시 매긴 뒤 다시 계산한다
      let sortOrder = await this.#planSortOrder(ownerId, todoId, target, position);
      if (sortOrder == null) {
        await this.#dependencies.todoRepository.renumberSortOrders(ownerId);
        // 다시 매기면 옮길 할 일과 기준 할 일의 값도 바뀐다. 옛 값과 새 자리가 같아도 저장을 건너뛰지 않게 다시 읽는다
        todo = await this.#lockTodo(todoId, ownerId);
        const renumberedTarget =
          targetTodoId == null ? null : await this.#findTarget(targetTodoId, ownerId);
        sortOrder = await this.#planSortOrder(ownerId, todoId, renumberedTarget, position);
      }
      if (sortOrder == null) {
        throw todoSortOrderExhausted();
      }
      if (todo.moveTo(sortOrder, this.#dependencies.clock.now())) {
        await this.#dependencies.todoRepository.save(todo);
      }

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

  async #lockTodo(todoId: TodoId, ownerId: UserId): Promise<Todo> {
    const todo = await this.#dependencies.todoRepository.lockByIdAndUserId(todoId, ownerId);
    if (todo == null) {
      throw todoNotFound(todoId.value);
    }
    return todo;
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
