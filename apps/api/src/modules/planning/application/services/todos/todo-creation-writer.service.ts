import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo, type TodoCreationDraft } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { expandRecurringDates } from "../../../domain/policies/todos/expand-recurring-dates.policy.js";
import type { CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import type { CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import type { TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface RecurringTodoCreationPlan {
  readonly data: CreateRecurringTodoData;
  readonly timezone: string;
  readonly draft: TodoCreationDraft;
  readonly dates: readonly string[];
  readonly recurrenceGroupId: string;
}

export function planRecurringTodoCreation(
  data: CreateRecurringTodoData,
  timezone: string,
): RecurringTodoCreationPlan {
  const draft = Todo.planCreation({
    userId: data.userId,
    categoryId: data.categoryId,
    title: data.title,
    startDate: parseDateOnly(data.startDate),
    scheduledTime: null,
    isAllDay: data.isAllDay,
    visibility: data.visibility,
  });
  const dates = expandRecurringDates(data.startDate, data.endDate, data.daysOfWeek);
  if (dates.length === 0)
    throw new ApplicationException(ErrorCode.SYS_0002, {
      message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
      startDate: data.startDate,
      endDate: data.endDate,
      daysOfWeek: data.daysOfWeek,
    });
  if (dates.length > RECURRING_TODO_LIMITS.MAX_INSTANCES)
    throw new ApplicationException(ErrorCode.TODO_0812, {
      count: dates.length,
      limit: RECURRING_TODO_LIMITS.MAX_INSTANCES,
    });
  return { data, timezone, draft, dates, recurrenceGroupId: randomUUID() };
}

interface TodoCreationWriterDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countActiveByCategory" | "getMaxSortOrder" | "create" | "createInlineItems" | "createMany"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
}

export class TodoCreationWriter {
  readonly #dependencies: TodoCreationWriterDependencies;

  constructor(dependencies: TodoCreationWriterDependencies) {
    this.#dependencies = dependencies;
  }

  async create(draft: TodoCreationDraft, items?: { title: string }[]): Promise<Todo> {
    await this.#dependencies.categoryOwnership.validateOwnership(draft.categoryId, draft.userId);
    const activeCount = await this.#dependencies.todoRepository.countActiveByCategory(
      draft.userId,
      draft.categoryId,
    );
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY)
      throw new ApplicationException(ErrorCode.TODO_0811, {
        activeCount,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(draft.userId);
    const created = await this.#dependencies.todoRepository.create({
      ...draft,
      sortOrder: maxSortOrder + 1,
    });
    if (items !== undefined && items.length > 0)
      await this.#dependencies.todoRepository.createInlineItems(created.getId().getValue(), items);
    return created;
  }

  async createRecurring(plan: RecurringTodoCreationPlan): Promise<Todo[]> {
    const { data, timezone, draft, dates, recurrenceGroupId } = plan;
    await this.#dependencies.categoryOwnership.validateOwnership(data.categoryId, data.userId);
    const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
      data.userId,
      data.categoryId,
    );
    if (activeInCategory + dates.length > TODO_LIMITS.MAX_PER_CATEGORY)
      throw new ApplicationException(ErrorCode.TODO_0813, {
        activeInCategory,
        batchSize: dates.length,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(data.userId);
    const items = dates.map((date, index) => ({
      ...draft,
      sortOrder: maxSortOrder + 1 + index,
      startDate: parseDateOnly(date),
      scheduledTime:
        data.scheduledTime === undefined || data.scheduledTime === null
          ? null
          : parseLocalDateTime(date, data.scheduledTime, timezone),
    }));
    return this.#dependencies.todoRepository.createMany(items, recurrenceGroupId, data.items);
  }
}
