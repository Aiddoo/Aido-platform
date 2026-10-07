import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { TodoCategory } from "../../../domain/aggregates/categories/todo-category.aggregate.js";
import {
  planReorderRelativeTo,
  planReorderToEdge,
  type ReorderPosition,
} from "../../../domain/policies/categories/category-reorder.policy.js";
import { PlanningCategoryLogEvent } from "../../observability/categories/planning-category-log.events.js";
import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

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
 * 커밋 후 목록 캐시를 무효화한다.
 */
interface ReorderTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    "findByIdAndUserId" | "getMaxSortOrder" | "shiftSortOrders" | "update"
  >;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class ReorderTodoCategory {
  readonly #dependencies: ReorderTodoCategoryDependencies;

  constructor(dependencies: ReorderTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ReorderTodoCategoryInput): Promise<TodoCategory> {
    const { userId, categoryId, targetCategoryId, position } = input;

    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);

      const category = await this.#dependencies.repository.findByIdAndUserId(categoryId, userId);
      if (category === null) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
          categoryId,
        });
      }

      if (categoryId === targetCategoryId) {
        return category;
      }

      let plan: ReturnType<typeof planReorderRelativeTo>;
      if (targetCategoryId !== undefined) {
        const target = await this.#dependencies.repository.findByIdAndUserId(
          targetCategoryId,
          userId,
        );
        if (target === null) {
          throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
            categoryId: targetCategoryId,
          });
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
      return this.#dependencies.repository.update(categoryId, {
        sortOrder: plan.newSortOrder,
      });
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: PlanningCategoryLogEvent.REORDERED,
      userId,
      categoryId: categoryId,
    });
    return result;
  }
}
