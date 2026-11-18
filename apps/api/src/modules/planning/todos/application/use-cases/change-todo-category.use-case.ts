import { TODO_LIMITS } from "@aido/api/vocabulary";

import {
  TodoCategoryLockKeys,
  TodoCategoryId,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import { type CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { categoryTodoLimitReached, todoNotFound } from "../todos.errors.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface ChangeTodoCategoryInput {
  readonly id: number;
  readonly userId: string;
  readonly categoryId: number;
}

interface ChangeTodoCategoryDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "lockByIdAndUserId" | "countCategoryUsage" | "save"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class ChangeTodoCategoryUseCase {
  readonly #dependencies: ChangeTodoCategoryDependencies;

  constructor(dependencies: ChangeTodoCategoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ChangeTodoCategoryInput): Promise<TodoReadModel> {
    const { id, userId, categoryId } = input;
    const todoId = TodoId.reconstitute(id);
    const ownerId = UserId.reconstitute(userId);
    const targetCategoryId = TodoCategoryId.reconstitute(categoryId);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(userId),
        TodoLockKeys.todo(id),
      ]);
      await this.#dependencies.categoryOwnership.validateOwnership(targetCategoryId, ownerId);

      const todo = await this.#dependencies.todoRepository.lockByIdAndUserId(todoId, ownerId);
      if (todo == null) {
        throw todoNotFound(id);
      }

      const changed = todo.changeCategory(targetCategoryId, this.#dependencies.clock.now());

      // 같은 카테고리여도 한도를 먼저 본다. 회차 하나를 옮겨도 규칙 1개로 세는 사용량은 그대로다.
      if (!todo.isCompleted() && !todo.isOccurrence()) {
        const activeInTarget = await this.#dependencies.todoRepository.countCategoryUsage(
          ownerId,
          targetCategoryId,
        );
        if (activeInTarget >= TODO_LIMITS.MAX_PER_CATEGORY) {
          throw categoryTodoLimitReached(activeInTarget);
        }
      }
      if (!changed) {
        return;
      }
      await this.#dependencies.todoRepository.save(todo);
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    await this.#dependencies.todoCache.invalidateTodoCategories(ownerId);
    await this.#dependencies.todoCache.invalidateFriendTodos(ownerId);

    this.#dependencies.logger.log({
      event: TodoLogEvent.CATEGORY_CHANGED,
      todoId: id,
      userId,
      categoryId,
    });

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, ownerId);
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }
}
