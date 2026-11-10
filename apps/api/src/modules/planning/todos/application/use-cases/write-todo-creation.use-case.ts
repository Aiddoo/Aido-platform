import { randomUUID } from "node:crypto";

import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";

import { TodoCreatedEvent } from "../../../shared/domain/todo-created.event.js";
import { Todo, type TodoCreationDraft } from "../../../shared/domain/todo.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../../../todo-series/application/ports/todo-series.repository.port.js";
import type { MaterializeTodoOccurrencesUseCase } from "../../../todo-series/application/use-cases/materialize-todo-occurrences.use-case.js";
import { RepeatRule, type RepeatSpec } from "../../../todo-series/domain/repeat-rule.vo.js";
import { TodoSeries } from "../../../todo-series/domain/todo-series.aggregate.js";
import type { CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import type { ResolvedCreateTodoData } from "../ports/staged-todo-creator.port.js";
import type { CreatedOccurrence, TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export function planTodoCreation(input: ResolvedCreateTodoData): TodoCreationDraft {
  return Todo.planCreation({
    userId: input.userId,
    categoryId: input.categoryId,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    scheduledLocalTime: input.scheduledTime ?? null,
    timezone: input.timezone,
    isAllDay: input.isAllDay,
    visibility: input.visibility,
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
  readonly occurrenceMaterializer: Pick<
    MaterializeTodoOccurrencesUseCase,
    "planFirstRun" | "persist"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

export class WriteTodoCreationUseCase {
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
    // 리마인더 예약과 planning.todo.created는 행과 함께 커밋한다. 옛 todo.created는 커밋 뒤 따로 나간다
    await this.#dependencies.applyTodoEvents.execute([
      new TodoCreatedEvent(created.getId().getValue(), draft.userId, draft.scheduledTime),
    ]);
    return created;
  }

  /** 상한 확인 → 규칙 저장 → 회차를 한 번에 만든다. 활성 UoW와 생성 잠금 안에서 호출한다. */
  async startSeries(input: ResolvedCreateTodoData, repeat: RepeatSpec): Promise<StartedSeries> {
    const { userId, categoryId } = input;
    if (input.endDate != null) {
      throw new ApplicationException(ErrorCode.TODO_0845, { field: "endDate" });
    }
    const at = now();
    const series = TodoSeries.planCreation({
      id: randomUUID(),
      userId,
      categoryId,
      title: input.title,
      visibility: input.visibility ?? "PUBLIC",
      scheduledLocalTime: input.scheduledTime ?? null,
      timezone: input.timezone,
      rule: RepeatRule.from(repeat),
      startDate: toDateString(input.startDate),
      checklistTemplate: input.items ?? [],
      at,
    });
    series.assertWithinPastLimit(at);
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);
    await this.#assertSeriesLimit(userId, input.usesLegacySeriesLimit === true);
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

  async #assertSeriesLimit(userId: string, usesLegacyLimit: boolean): Promise<void> {
    const limit = usesLegacyLimit
      ? TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY
      : TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER;
    const activeCount = await this.#dependencies.todoSeriesRepository.countActiveByUserId(userId);
    if (activeCount < limit) {
      return;
    }
    if (usesLegacyLimit) {
      // 출시 앱은 TODO_0842를 몰라 SYS_0001로 보인다. 이 경로에서 이미 받는 한도 거절로 돌려준다.
      throw new ApplicationException(ErrorCode.TODO_0813, {
        activeInCategory: activeCount,
        batchSize: 1,
        maxPerCategory: limit,
      });
    }
    throw new ApplicationException(ErrorCode.TODO_0842, { limit, activeCount });
  }
}
