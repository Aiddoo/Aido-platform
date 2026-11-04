import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo, type TodoCreationDraft } from "../../../domain/aggregates/todos/todo.aggregate.js";
import { expandRecurringDates } from "../../../domain/policies/todos/expand-recurring-dates.policy.js";
import type { CreateTodoData, TodoRecurrence } from "../../models/todos/todo.types.js";
import type { CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import type { TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";

export interface RecurringTodoCreationPlan {
  readonly userId: string;
  readonly categoryId: number;
  readonly drafts: readonly TodoCreationDraft[];
  readonly items: readonly { title: string }[] | undefined;
  readonly recurrenceGroupId: string;
}

function planDraftOn(data: CreateTodoData, date: string, endDate: Date | null): TodoCreationDraft {
  return Todo.planCreation({
    userId: data.userId,
    categoryId: data.categoryId,
    title: data.title,
    startDate: parseDateOnly(date),
    endDate,
    scheduledTime:
      data.scheduledTime == null
        ? null
        : parseLocalDateTime(date, data.scheduledTime, data.timezone),
    isAllDay: data.isAllDay,
    visibility: data.visibility,
  });
}

export function planTodoCreation(data: CreateTodoData): TodoCreationDraft {
  return planDraftOn(data, toDateString(data.startDate), data.endDate ?? null);
}

export function planRecurringTodoCreation(
  data: CreateTodoData,
  recurrence: TodoRecurrence,
): RecurringTodoCreationPlan {
  const startDate = toDateString(data.startDate);
  const dates = expandRecurringDates(startDate, recurrence.endDate, recurrence.daysOfWeek);
  if (dates.length === 0) {
    throw new ApplicationException(ErrorCode.TODO_0843, { startDate });
  }
  if (dates.length > RECURRING_TODO_LIMITS.MAX_INSTANCES) {
    throw new ApplicationException(ErrorCode.TODO_0812, {
      count: dates.length,
      limit: RECURRING_TODO_LIMITS.MAX_INSTANCES,
    });
  }
  return {
    userId: data.userId,
    categoryId: data.categoryId,
    drafts: dates.map((date) => planDraftOn(data, date, null)),
    items: data.items,
    recurrenceGroupId: randomUUID(),
  };
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

  async create(draft: TodoCreationDraft, items?: readonly { title: string }[]): Promise<Todo> {
    await this.#dependencies.categoryOwnership.validateOwnership(draft.categoryId, draft.userId);
    const activeCount = await this.#dependencies.todoRepository.countActiveByCategory(
      draft.userId,
      draft.categoryId,
    );
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw new ApplicationException(ErrorCode.TODO_0811, {
        activeCount,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    }
    const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(draft.userId);
    const created = await this.#dependencies.todoRepository.create({
      ...draft,
      sortOrder: maxSortOrder + 1,
    });
    if (items != null && items.length > 0) {
      await this.#dependencies.todoRepository.createInlineItems(created.getId().getValue(), items);
    }
    return created;
  }

  async createRecurring(plan: RecurringTodoCreationPlan): Promise<Todo[]> {
    const { userId, categoryId, drafts, items, recurrenceGroupId } = plan;
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);
    const activeInCategory = await this.#dependencies.todoRepository.countActiveByCategory(
      userId,
      categoryId,
    );
    if (activeInCategory + drafts.length > TODO_LIMITS.MAX_PER_CATEGORY) {
      throw new ApplicationException(ErrorCode.TODO_0813, {
        activeInCategory,
        batchSize: drafts.length,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    }
    const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(userId);
    const plans = drafts.map((draft, index) => ({
      ...draft,
      sortOrder: maxSortOrder + 1 + index,
    }));
    return this.#dependencies.todoRepository.createMany(plans, recurrenceGroupId, items);
  }
}
