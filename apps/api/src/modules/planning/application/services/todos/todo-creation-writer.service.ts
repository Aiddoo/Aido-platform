import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { Todo, type TodoCreationDraft } from "../../../domain/aggregates/todos/todo.aggregate.js";
import {
  RepeatRule,
  type RepeatSpec,
} from "../../../domain/value-objects/series/repeat-rule.vo.js";
import type { CreateTodoData } from "../../models/todos/todo.types.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import type { CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import type {
  CreatedOccurrence,
  TodoRepositoryPort,
} from "../../ports/todos/todo.repository.port.js";
import type { TodoOccurrenceMaterializer } from "../series/todo-occurrence-materializer.service.js";

export function planTodoCreation(data: CreateTodoData): TodoCreationDraft {
  return Todo.planCreation({
    userId: data.userId,
    categoryId: data.categoryId,
    title: data.title,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    scheduledTime:
      data.scheduledTime == null
        ? null
        : parseLocalDateTime(toDateString(data.startDate), data.scheduledTime, data.timezone),
    isAllDay: data.isAllDay,
    visibility: data.visibility,
  });
}

export interface StartedSeries {
  readonly series: TodoSeries;
  readonly occurrences: readonly CreatedOccurrence[];
}

interface TodoCreationWriterDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countCategoryUsage" | "getMaxSortOrder" | "create" | "createInlineItems"
  >;
  readonly todoSeriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId" | "insert">;
  readonly occurrenceMaterializer: Pick<TodoOccurrenceMaterializer, "planFirstRun" | "persist">;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
}

export class TodoCreationWriter {
  readonly #dependencies: TodoCreationWriterDependencies;

  constructor(dependencies: TodoCreationWriterDependencies) {
    this.#dependencies = dependencies;
  }

  async createSingle(
    draft: TodoCreationDraft,
    items?: readonly { title: string }[],
  ): Promise<Todo> {
    await this.#dependencies.categoryOwnership.validateOwnership(draft.categoryId, draft.userId);
    const activeCount = await this.#dependencies.todoRepository.countCategoryUsage(
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

  /** 상한 확인 → 규칙 저장 → 회차를 한 번에 만든다. 활성 UoW와 생성 잠금 안에서 호출한다. */
  async startSeries(data: CreateTodoData, repeat: RepeatSpec): Promise<StartedSeries> {
    const { userId, categoryId } = data;
    if (data.endDate != null) {
      throw new ApplicationException(ErrorCode.TODO_0845, { field: "endDate" });
    }
    const at = now();
    const series = TodoSeries.planCreation({
      id: randomUUID(),
      userId,
      categoryId,
      title: data.title,
      visibility: data.visibility ?? "PUBLIC",
      scheduledLocalTime: data.scheduledTime ?? null,
      timezone: data.timezone,
      rule: RepeatRule.from(repeat),
      startDate: toDateString(data.startDate),
      checklistTemplate: data.items ?? [],
      sortOrder: await this.#dependencies.todoRepository.getMaxSortOrder(userId),
      at,
    });
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);
    const activeCount = await this.#dependencies.todoSeriesRepository.countActiveByUserId(userId);
    if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
      throw new ApplicationException(ErrorCode.TODO_0842, {
        limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER,
        activeCount,
      });
    }
    const activeInCategory = await this.#dependencies.todoRepository.countCategoryUsage(
      userId,
      categoryId,
    );
    if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw new ApplicationException(ErrorCode.TODO_0813, {
        activeInCategory,
        batchSize: 1,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    }
    const drafts = this.#dependencies.occurrenceMaterializer.planFirstRun(series, at);
    await this.#dependencies.todoSeriesRepository.insert(series);
    const occurrences = await this.#dependencies.occurrenceMaterializer.persist(series, drafts);
    return { series, occurrences };
  }
}
