import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** 하위 항목 추가 입력. */
export interface AddTodoItemInput {
  todoId: number;
  userId: string;
  title: string;
}

/**
 * 하위 항목 추가 use-case
 *
 * TX 안에서 애그리게잇 로드 → 애그리게잇이 항목 한도·제목 불변식 검증 및
 * sortOrder 계획(planItemAddition) → 계획 영속화 → 읽기 포트로 재조회.
 * 동시 추가 레이스 특성은 기존 in-TX count 방식과 동등합니다(read committed).
 */
interface AddTodoItemDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly todoCache: TodoCachePort;
  readonly logger: ApplicationLogger;
}

export class AddTodoItem {
  readonly #dependencies: AddTodoItemDependencies;

  constructor(dependencies: AddTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: AddTodoItemInput): Promise<TodoResponse> {
    const { todoId, userId, title } = input;

    // TX 안에서 애그리게잇 로드 → 불변식 검증·계획(도메인) → 영속화
    await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const plan = todo.planItemAddition(title);
      await this.#dependencies.todoRepository.createItem(todoId, plan);
    });

    this.#dependencies.logger.log(`Todo item added: todo=${todoId} for user: ${userId}`);

    // 친구 공개 투두 캐시 무효화 (TX 커밋 후)
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    // 3. 부모 할 일 전체 재조회 (items·itemStats 포함)
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
