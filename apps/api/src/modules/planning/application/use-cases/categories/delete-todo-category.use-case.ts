import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { type TodoCategoryCachePort } from "../../ports/categories/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../../ports/categories/todo-category.repository.port.js";

export interface DeleteTodoCategoryInput {
  userId: string;
  categoryId: number;
  moveToCategoryId?: number;
}

/**
 * 카테고리 삭제 use-case.
 *
 * 트랜잭션 안에서 소유·최소개수(1개 이상 유지)·잔여 할 일을 검사하고, 할 일이 있으면 지정 카테고리로
 * 이동 후 삭제한다(Todo.category는 onDelete: Restrict). 커밋 후 목록 캐시를 무효화한다.
 */
interface DeleteTodoCategoryDependencies {
  readonly repository: TodoCategoryRepositoryPort;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodoCategory {
  readonly #dependencies: DeleteTodoCategoryDependencies;

  constructor(dependencies: DeleteTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoCategoryInput): Promise<void> {
    const { userId, categoryId, moveToCategoryId } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);

      const category = await this.#dependencies.repository.findByIdAndUserId(categoryId, userId);
      if (!category) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
          categoryId,
        });
      }

      const total = await this.#dependencies.repository.countByUserId(userId);
      if (total <= 1) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0854);
      }

      const todoCount = await this.#dependencies.repository.getTodoCount(categoryId);
      if (todoCount > 0) {
        if (!moveToCategoryId) {
          throw new ApplicationException(ErrorCode.TODO_CATEGORY_0855, {
            categoryId,
            todoCount,
          });
        }
        if (moveToCategoryId === categoryId) {
          throw new ApplicationException(ErrorCode.SYS_0002, {
            message: "삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다",
            categoryId,
            moveToCategoryId,
          });
        }
        const moveTarget = await this.#dependencies.repository.findByIdAndUserId(
          moveToCategoryId,
          userId,
        );
        if (!moveTarget) {
          throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
            categoryId: moveToCategoryId,
          });
        }
        await this.#dependencies.repository.moveTodosToCategory(categoryId, moveToCategoryId);
      }

      await this.#dependencies.repository.delete(categoryId);
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug(`카테고리 삭제: id=${categoryId}, userId=${userId}`);
  }
}
