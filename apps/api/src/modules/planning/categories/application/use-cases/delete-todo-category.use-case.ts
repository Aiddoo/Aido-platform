import { randomUUID } from "node:crypto";

import type { CategoryTodoHandling } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import type { RemoveCategoryTodosUseCase } from "../../../todos/application/use-cases/remove-category-todos.use-case.js";
import { CategoryChangedEvent } from "../../domain/category-changed.event.js";
import { planCategoryDeletion } from "../../domain/category-deletion.domain-service.js";
import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import { categoryDeletionRejected, todoCategoryNotFound } from "../categories.errors.js";
import { TodoCategoryLockKeys } from "../categories.lock-keys.js";
import { TodoCategoryLogEvent } from "../categories.log-events.js";
import { type TodoCategoryCachePort } from "../ports/todo-category-cache.port.js";
import { type TodoCategoryRepositoryPort } from "../ports/todo-category.repository.port.js";
import type { TodoCategoryDeletionReadModel } from "../read-models/todo-category-deletion.read-model.js";

export interface DeleteTodoCategoryInput {
  userId: string;
  categoryId: number;
  moveToCategoryId?: number;
  /** 생략은 출시 앱(1.15.0까지)의 요청이다. 할 일이 있으면 moveToCategoryId가 필요하다 */
  todoHandling?: CategoryTodoHandling;
}

interface DeleteTodoCategoryDependencies {
  readonly repository: Pick<
    TodoCategoryRepositoryPort,
    | "findByIdAndUserId"
    | "countByUserId"
    | "countTodos"
    | "countActiveSeries"
    | "moveTodosToCategory"
    | "delete"
  >;
  readonly categoryTodos: Pick<RemoveCategoryTodosUseCase, "execute">;
  readonly cache: TodoCategoryCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

/**
 * 카테고리를 지운다. 잠금 → 읽기 → 계획 → 실행 → 발행 순서다.
 * 할 일을 옮기거나 함께 지우는 모든 쓰기는 카테고리·정렬 잠금 아래에서 하므로 그동안 이 카테고리에
 * 할 일이 새로 들어오거나(생성·이동·반복 회차) 진행 중 규칙이 바뀌지 않는다.
 */
export class DeleteTodoCategoryUseCase {
  readonly #dependencies: DeleteTodoCategoryDependencies;

  constructor(dependencies: DeleteTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoCategoryInput): Promise<TodoCategoryDeletionReadModel> {
    const { repository, categoryTodos, mutationLock, unitOfWork, clock, eventPublisher } =
      this.#dependencies;
    const startedAt = clock.now();
    const userId = UserId.reconstitute(input.userId);
    const categoryId = TodoCategoryId.reconstitute(input.categoryId);
    const moveToCategoryId =
      input.moveToCategoryId == null ? null : TodoCategoryId.reconstitute(input.moveToCategoryId);

    const deletion = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(input.userId),
        TodoLockKeys.sortOrder(input.userId),
      ]);

      const category = await repository.findByIdAndUserId(categoryId, userId);
      if (category == null) {
        throw todoCategoryNotFound(categoryId);
      }
      const categoryCount = await repository.countByUserId(userId);
      const todoCount = await repository.countTodos(userId, categoryId);
      const activeSeriesCount = await repository.countActiveSeries(categoryId);

      const plan = planCategoryDeletion({
        categoryId,
        categoryCount,
        todoCount: todoCount.total,
        activeSeriesCount,
        todoHandling: input.todoHandling ?? null,
        moveToCategoryId,
      });
      if (!plan.ok) {
        throw categoryDeletionRejected({
          reason: plan.reason,
          categoryId,
          moveToCategoryId,
          todoCount: todoCount.total,
        });
      }

      const result = await match(plan)
        .with({ plan: "delete-empty" }, async () => ({
          todoHandling: "none" as const,
          moveToCategoryId: null,
        }))
        .with({ plan: "move" }, async ({ moveToCategoryId: targetId }) => {
          const target = await repository.findByIdAndUserId(targetId, userId);
          if (target == null) {
            throw todoCategoryNotFound(targetId);
          }
          await repository.moveTodosToCategory(userId, categoryId, targetId);
          return { todoHandling: "move" as const, moveToCategoryId: targetId.value };
        })
        .with({ plan: "delete-with-todos" }, async () => {
          await categoryTodos.execute({ userId, categoryId });
          return { todoHandling: "delete" as const, moveToCategoryId: null };
        })
        .exhaustive();

      await repository.delete(categoryId);
      await eventPublisher.publish([
        new CategoryChangedEvent({
          eventName: "planning.todo-category.deleted",
          eventId: randomUUID(),
          occurredAt: clock.now(),
          categoryId: input.categoryId,
          userId: input.userId,
        }),
      ]);
      return {
        ...result,
        todoCount: todoCount.total,
        seriesCount: activeSeriesCount,
      };
    });

    await this.#dependencies.cache.invalidate(userId);
    this.#dependencies.logger.log({
      event: TodoCategoryLogEvent.DELETED,
      userId: input.userId,
      categoryId: input.categoryId,
      todoHandling: deletion.todoHandling,
      todoCount: deletion.todoCount,
      seriesCount: deletion.seriesCount,
      durationMs: startedAt.until(clock.now()).total("milliseconds"),
    });
    return deletion;
  }
}
