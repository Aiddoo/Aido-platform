import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { type CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
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
    "findByIdAndUserId" | "countCategoryUsage" | "updateCategory"
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

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(userId),
        TodoLockKeys.todo(id),
      ]);
      await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);

      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      const changed = todo.changeCategory(categoryId, this.#dependencies.clock.now());

      // 같은 카테고리여도 한도를 먼저 본다. 회차 하나를 옮겨도 규칙 1개로 세는 사용량은 그대로다.
      if (!todo.completed && todo.seriesId == null) {
        const activeInTarget = await this.#dependencies.todoRepository.countCategoryUsage(
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
      if (!changed) {
        return;
      }
      await this.#dependencies.todoRepository.updateCategory(id, todo.categoryId);
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log({
      event: TodoLogEvent.CATEGORY_CHANGED,
      todoId: id,
      userId,
      categoryId,
    });

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
