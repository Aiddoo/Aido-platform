import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface ChangeTodoCategoryInput {
  readonly id: number;
  readonly userId: string;
  readonly categoryId: number;
}

interface ChangeTodoCategoryDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "countActiveByCategory" | "updateCategory"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
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

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todo(id),
      ]);
      await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);

      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo === null) {
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

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.CATEGORY_CHANGED,
      todoId: id,
      userId,
      categoryId,
    });

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
