import { randomUUID } from "node:crypto";

import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo, type TodoCreationPlan } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { expandRecurringDates } from "../../../domain/policies/todos/expand-recurring-dates.policy.js";
import type { CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface CreateRecurringTodosResult {
  readonly todos: TodoResponse[];
  readonly count: number;
}

export interface CreateRecurringTodosInput {
  readonly data: CreateRecurringTodoData;
  readonly timezone: string;
}

interface CreateRecurringTodosDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countActiveByCategory" | "getMaxSortOrder" | "createMany"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findManyByRecurrenceGroupId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class CreateRecurringTodos {
  readonly #dependencies: CreateRecurringTodosDependencies;

  constructor(dependencies: CreateRecurringTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateRecurringTodosInput): Promise<CreateRecurringTodosResult> {
    const { data, timezone } = input;

    const draft = Todo.planCreation({
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      startDate: parseDateOnly(data.startDate),
      scheduledTime: null,
      isAllDay: data.isAllDay,
      visibility: data.visibility,
    });

    const matchingDates = expandRecurringDates(data.startDate, data.endDate, data.daysOfWeek);
    const todoCount = matchingDates.length;

    if (todoCount === 0) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
        startDate: data.startDate,
        endDate: data.endDate,
        daysOfWeek: data.daysOfWeek,
      });
    }
    if (todoCount > RECURRING_TODO_LIMITS.MAX_INSTANCES) {
      throw new ApplicationException(ErrorCode.TODO_0812, {
        count: todoCount,
        limit: RECURRING_TODO_LIMITS.MAX_INSTANCES,
      });
    }

    const recurrenceGroupId = randomUUID();

    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(data.userId),
        MutationLockKeys.todoSortOrder(data.userId),
      ]);
      await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, data.userId);

      const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
        data.userId,
        data.categoryId,
      );
      if (activeInCategory + todoCount > TODO_LIMITS.MAX_PER_CATEGORY) {
        throw new ApplicationException(ErrorCode.TODO_0813, {
          activeInCategory,
          batchSize: todoCount,
          maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
        });
      }

      const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(data.userId);

      const items: TodoCreationPlan[] = matchingDates.map((dateStr, index) => ({
        ...draft,
        sortOrder: maxSortOrder + 1 + index,
        startDate: parseDateOnly(dateStr),
        scheduledTime:
          data.scheduledTime === undefined || data.scheduledTime === null
            ? null
            : parseLocalDateTime(dateStr, data.scheduledTime, timezone),
      }));

      return this.#dependencies.todoRepository.createMany(items, recurrenceGroupId, data.items);
    });

    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.RECURRING_CREATED,
      userId: data.userId,
      recurrenceGroupId,
      todoCount,
    });

    await this.#dependencies.todoCache.invalidateTodoCategories(data.userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(data.userId);

    const domainEvents = created.flatMap((todo) => {
      todo.markCreated();
      return todo.pullDomainEvents();
    });
    await this.#dependencies.eventPublisher.publishAll(domainEvents);

    const todos = await this.#dependencies.todoReadRepository.findManyByRecurrenceGroupId(
      data.userId,
      recurrenceGroupId,
    );

    return { todos, count: todoCount };
  }
}
