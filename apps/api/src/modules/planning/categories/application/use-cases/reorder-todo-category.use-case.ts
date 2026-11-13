import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCachePort } from "../../../todos/application/ports/todo-cache.port.js";
import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPosition,
} from "../../domain/category-ordering.domain-service.js";
import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import { todoCategoryNotFound } from "../categories.errors.js";
import { TodoCategoryLockKeys } from "../categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../categories.log-events.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

export interface ReorderTodoCategoryInput {
  userId: string;
  categoryId: number;
  targetCategoryId?: number;
  position: ReorderPosition;
}

/**
 * 카테고리 재배치 use-case.
 *
 * 트랜잭션 안에서 이동 계획(사이 카테고리 시프트 + 새 순번)을 계산·적용한다. 자기 자신 대상이면 no-op.
 * 커밋 후 목록 캐시와 친구 화면 할 일 캐시를 무효화한다.
 */
interface ReorderTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findByIdAndUserId" | "getMaxSortOrder" | "shiftSortOrders" | "update"
  >;
  readonly cache: TodoCategoryCachePort;
  // 친구 화면 할 일 캐시가 카테고리 순서를 담고 그 순서로 정렬한다
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class ReorderTodoCategoryUseCase {
  readonly #dependencies: ReorderTodoCategoryDependencies;

  constructor(dependencies: ReorderTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoCategoryInput): Promise<TodoCategory> {
    const { categoryId, targetCategoryId, position } = input;
    const userId = UserId.reconstitute(input.userId);

    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
      ]);

      const category = await this.#dependencies.repository.findByIdAndUserId(
        TodoCategoryId.reconstitute(categoryId),
        userId,
      );
      if (category == null) {
        throw todoCategoryNotFound(TodoCategoryId.reconstitute(categoryId));
      }

      if (categoryId === targetCategoryId) {
        return category;
      }

      let plan: ReturnType<typeof planReorderRelativeTo>;
      if (targetCategoryId != null) {
        const target = await this.#dependencies.repository.findByIdAndUserId(
          TodoCategoryId.reconstitute(targetCategoryId),
          userId,
        );
        if (target == null) {
          throw todoCategoryNotFound(TodoCategoryId.reconstitute(targetCategoryId));
        }
        plan = planReorderRelativeTo(category.sortOrder, target.sortOrder, position);
      } else {
        const maxSortOrder = await this.#dependencies.repository.getMaxSortOrder(userId);
        plan = planReorderToEdge(category.sortOrder, position, maxSortOrder);
      }

      await this.#dependencies.repository.shiftSortOrders(
        userId,
        plan.shift.from,
        plan.shift.to,
        plan.shift.delta,
      );
      this.#dependencies.afterCommit.register(() =>
        this.#dependencies.todoCache.invalidateFriendTodos(userId),
      );
      return this.#dependencies.repository.update(category.id, {
        sortOrder: plan.newSortOrder,
      });
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: TodoCategoryLogEvent.REORDERED,
      userId: input.userId,
      categoryId: categoryId,
    });
    return result;
  }
}
