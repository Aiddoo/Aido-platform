import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** 하위 항목 삭제 입력. */
export interface DeleteTodoItemInput {
  todoId: number;
  itemId: number;
  userId: string;
}

/**
 * 하위 항목 삭제 use-case
 *
 * TX 안에서 소유권·항목 존재 확인 후 삭제 → 읽기 포트로 부모 할 일 재조회
 * (itemStats 재계산 반영).
 */
interface DeleteTodoItemDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodoItem {
  readonly #dependencies: DeleteTodoItemDependencies;

  constructor(dependencies: DeleteTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoItemInput): Promise<TodoResponse> {
    const { todoId, itemId, userId } = input;

    // 1. TX 안에서 소유권·항목 존재 확인 후 삭제 (원자성)
    await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }
      // 애그리게잇이 존재를 검증하고 자식 엔티티를 제거
      todo.removeItem(itemId);

      await this.#dependencies.todoRepository.deleteItem(itemId);
    });

    this.#dependencies.logger.log(
      `Todo item deleted: todo=${todoId}, item=${itemId} for user: ${userId}`,
    );

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
