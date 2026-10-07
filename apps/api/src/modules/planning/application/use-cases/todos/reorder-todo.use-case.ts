import type { ReorderPosition, Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPlan,
} from "../../../domain/services/todos/reorder-position.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 순서 변경 입력. */
export interface ReorderTodoInput {
  id: number;
  userId: string;
  targetTodoId: number | undefined;
  position: ReorderPosition;
}

/**
 * Todo 순서 변경 use-case (드래그 앤 드롭)
 *
 * 전체 트랜잭션 안에서: 소유권 확인 → 도메인 정책(planReorderRelativeTo /
 * planReorderToEdge)으로 시프트 계획 계산 → 시프트·sortOrder 영속화 →
 * 커밋 후 읽기 포트로 응답 재조회.
 * targetTodoId가 자기 자신이면 쓰기 없이 현재 상태를 반환합니다.
 */
interface ReorderTodoDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly logger: ApplicationLogger;
}

export class ReorderTodo {
  readonly #dependencies: ReorderTodoDependencies;

  constructor(dependencies: ReorderTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoInput): Promise<TodoResponse> {
    const { id, userId, targetTodoId, position } = input;

    // 1. 트랜잭션 안에서 소유권 확인 → 새 sortOrder 계산·시프트 → 영속화
    await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      // 자기 자신을 기준으로 지정하면 이동 없음
      if (targetTodoId === id) {
        return;
      }

      let plan: ReorderPlan;
      if (targetTodoId) {
        const targetTodo = await this.#dependencies.todoRepository.findByIdAndUserId(
          targetTodoId,
          userId,
        );
        if (!targetTodo) {
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

      this.#dependencies.logger.log(
        `Todo reordered: ${id} to sortOrder ${plan.newSortOrder} for user: ${userId}`,
      );
    });

    // 친구 공개 투두 캐시 무효화 (TX 커밋 후)
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    // 2. 응답 재조회
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
