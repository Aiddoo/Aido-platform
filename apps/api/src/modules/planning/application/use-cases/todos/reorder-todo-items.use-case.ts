import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** 하위 항목 순서 일괄 변경 입력. */
export interface ReorderTodoItemsInput {
  todoId: number;
  userId: string;
  itemIds: number[];
}

/**
 * 하위 항목 순서 일괄 변경 use-case
 *
 * TX 안에서 소유권 확인 → 전체 항목 ID 집합 일치 검증(부분 전달 시 sortOrder 충돌 방지) →
 * 배열 인덱스를 새 sortOrder로 일괄 재정렬 → 읽기 포트로 부모 할 일 재조회.
 */
interface ReorderTodoItemsDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly logger: ApplicationLogger;
}

export class ReorderTodoItems {
  readonly #dependencies: ReorderTodoItemsDependencies;

  constructor(dependencies: ReorderTodoItemsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoItemsInput): Promise<TodoResponse> {
    const { todoId, userId, itemIds } = input;

    // 1. TX 안에서 소유권 확인 → 집합 검증 → 일괄 재정렬 (원자성)
    await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      // 전체 항목 ID 집합 일치 검증은 애그리게잇 불변식 (부분 전달 방지)
      todo.validateItemsReorder(itemIds);

      await this.#dependencies.todoRepository.reorderItems(itemIds);
    });

    this.#dependencies.logger.log(`Todo items reordered: todo=${todoId} for user: ${userId}`);

    // 친구 공개 투두 캐시 무효화 (TX 커밋 후)
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    // 2. 부모 할 일 전체 재조회
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
