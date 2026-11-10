import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import { CategoryChangedEvent } from "../../domain/category-changed.event.js";
import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import { TodoCategoryLockKeys } from "../categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../categories.log-events.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";

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
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    | "findByIdAndUserId"
    | "countByUserId"
    | "getTodoCount"
    | "countActiveSeries"
    | "moveTodosToCategory"
    | "delete"
  >;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class DeleteTodoCategoryUseCase {
  readonly #dependencies: DeleteTodoCategoryDependencies;

  constructor(dependencies: DeleteTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoCategoryInput): Promise<void> {
    const { categoryId, moveToCategoryId } = input;
    const userId = UserId.reconstitute(input.userId);
    const id = TodoCategoryId.reconstitute(categoryId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
        TodoLockKeys.sortOrder(input.userId),
      ]);

      const category = await this.#dependencies.repository.findByIdAndUserId(id, userId);
      if (category == null) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
          categoryId,
        });
      }

      const total = await this.#dependencies.repository.countByUserId(userId);
      if (total <= 1) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0854);
      }

      const todoCount = await this.#dependencies.repository.getTodoCount(id);
      // 회차가 아직 없어도 진행 중 규칙이 있으면 옮길 곳을 받아야 한다.
      const activeSeries = await this.#dependencies.repository.countActiveSeries(id);
      if (todoCount + activeSeries > 0) {
        if (moveToCategoryId == null) {
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
        const moveTargetId = TodoCategoryId.reconstitute(moveToCategoryId);
        const moveTarget = await this.#dependencies.repository.findByIdAndUserId(
          moveTargetId,
          userId,
        );
        if (moveTarget == null) {
          throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, {
            categoryId: moveToCategoryId,
          });
        }
        await this.#dependencies.repository.moveTodosToCategory(id, moveTargetId);
      }

      await this.#dependencies.repository.delete(id);
      await this.#dependencies.eventPublisher.publish([
        new CategoryChangedEvent({
          eventName: "planning.todo-category.deleted",
          eventId: randomUUID(),
          occurredAt: this.#dependencies.clock.now(),
          categoryId,
          userId: input.userId,
        }),
      ]);
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.debug({
      event: TodoCategoryLogEvent.DELETED,
      userId: input.userId,
      categoryId: categoryId,
    });
  }
}
