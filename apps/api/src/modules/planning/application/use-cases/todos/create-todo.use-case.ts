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

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { CreateTodoData } from "../../models/todos/todo.types.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export type CreateTodoInput = CreateTodoData;

interface CreateTodoDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countActiveByCategory" | "getMaxSortOrder" | "create" | "createInlineItems"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class CreateTodo {
  readonly #dependencies: CreateTodoDependencies;

  constructor(dependencies: CreateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoInput): Promise<TodoResponse> {
    const draft = Todo.planCreation({
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      scheduledTime: input.scheduledTime,
      isAllDay: input.isAllDay,
      visibility: input.visibility,
    });

    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(input.userId),
        MutationLockKeys.todoSortOrder(input.userId),
      ]);
      await this.#dependencies.categoryOwnership.validateOwnership(input.categoryId, input.userId);

      const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
        input.userId,
        input.categoryId,
      );
      if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
        throw new ApplicationException(ErrorCode.TODO_0811, {
          activeCount: activeInCategory,
          maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
        });
      }

      const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(input.userId);

      const todo = await this.#dependencies.todoRepository.create({
        ...draft,
        sortOrder: maxSortOrder + 1,
      });

      if (input.items !== undefined && input.items.length > 0) {
        await this.#dependencies.todoRepository.createInlineItems(
          todo.getId().getValue(),
          input.items,
        );
      }

      return todo;
    });

    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.CREATED,
      todoId: created.getId().getValue(),
      userId: input.userId,
    });

    await this.#dependencies.todoCache.invalidateTodoCategories(input.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(input.userId);

    created.markCreated();
    await this.#dependencies.eventPublisher.publishAll(created.pullDomainEvents());

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      input.userId,
    );
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, {
        todoId: created.getId().getValue(),
      });
    }
    return response;
  }
}
