import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** 하위 항목 수정 입력. */
export interface UpdateTodoItemInput {
  todoId: number;
  itemId: number;
  userId: string;
  data: { title?: string; completed?: boolean };
}

/**
 * 하위 항목 수정 use-case (제목/완료 토글)
 *
 * TX 안에서 소유권·항목 존재 확인 후 수정 → 읽기 포트로 부모 할 일 재조회.
 * 하위 항목 완료는 부모 완료·스트릭·리마인더에 영향을 주지 않습니다(레거시 동작 보존).
 */
interface UpdateTodoItemDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly logger: ApplicationLogger;
}

export class UpdateTodoItem {
  readonly #dependencies: UpdateTodoItemDependencies;

  constructor(dependencies: UpdateTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoItemInput): Promise<TodoResponse> {
    const { todoId, itemId, userId, data } = input;

    // 1. TX 안에서 소유권·항목 존재 확인 후 수정 (원자성)
    await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }
      // 애그리게잇이 존재·제목 불변식을 검증하고 자식 엔티티를 전이시킴
      const item = todo.updateItem(itemId, data);

      // 요청에 포함된 필드만 쓰되, 값은 엔티티 상태에서 가져옴 (단일 소스)
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

    this.#dependencies.logger.log(
      `Todo item updated: todo=${todoId}, item=${itemId} for user: ${userId}`,
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
