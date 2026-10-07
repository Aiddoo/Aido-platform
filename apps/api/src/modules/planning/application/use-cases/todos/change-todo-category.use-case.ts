import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

/** Todo 카테고리 변경 입력. */
export interface ChangeTodoCategoryInput {
  id: number;
  userId: string;
  categoryId: number;
}

/**
 * Todo 카테고리 변경 use-case
 *
 * 소유권 확인 → 대상 카테고리 소유권 확인(TX 외부) →
 * 활성(미완료) 할 일이면 TX 안에서 한도 체크 후 이동(race 방지),
 * 완료된 할 일이면 TX 없이 이동 → 캐시 무효화 → 읽기 포트로 응답 재조회.
 */
interface ChangeTodoCategoryDependencies {
  readonly todoRepository: TodoRepositoryPort;
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly categoryOwnership: CategoryOwnershipPort;
  readonly todoCache: TodoCachePort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class ChangeTodoCategory {
  readonly #dependencies: ChangeTodoCategoryDependencies;

  constructor(dependencies: ChangeTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ChangeTodoCategoryInput): Promise<TodoResponse> {
    const { id, userId, categoryId } = input;

    // 1. 대상 카테고리 소유권 확인 (읽기 전용, TX 외부)
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);

    // 2. TX 안에서 로드 → 애그리게잇 전이 → 활성 할 일만 한도 체크 후 영속화 (race 방지)
    const events = await this.#dependencies.unitOfWork.run(async () => {
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (!todo) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      todo.changeCategory(categoryId);
      const targetCategoryId = todo.toPersistence().categoryId;

      if (!todo.isCompleted()) {
        const activeInTarget = await this.#dependencies.todoRepository.countActiveByCategory(
          userId,
          categoryId,
        );
        if (activeInTarget >= TODO_LIMITS.MAX_PER_CATEGORY) {
          throw new ApplicationException(ErrorCode.TODO_0811, {
            activeCount: activeInTarget,
            maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
          });
        }
      }
      await this.#dependencies.todoRepository.updateCategory(id, targetCategoryId);
      return todo.pullDomainEvents();
    });

    // 3. 저장(TX 커밋) 완료 후 이벤트 발행 (daily-completion 캐시 무효화 트리거)
    await this.#dependencies.eventPublisher.publishAll(events);

    // 4. 캐시 무효화 (todoCount 변경)
    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log(
      `Todo category updated: ${id} -> ${categoryId} for user: ${userId}`,
    );

    // 5. 응답 재조회
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (!response) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
