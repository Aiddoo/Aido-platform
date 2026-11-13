import { TODO_LIMITS, TODO_SERIES_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { TodoSchedule } from "../../../shared/domain/todo-schedule.vo.js";
import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import { Todo, type TodoEvent } from "../../../shared/domain/todo.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../../../todo-series/application/ports/todo-series.repository.port.js";
import type { MaterializeTodoOccurrencesUseCase } from "../../../todo-series/application/use-cases/materialize-todo-occurrences.use-case.js";
import { RepeatRule, type RepeatSpec } from "../../../todo-series/domain/repeat-rule.vo.js";
import { TodoSeriesId } from "../../../todo-series/domain/todo-series-id.vo.js";
import { TodoSeries } from "../../../todo-series/domain/todo-series.aggregate.js";
import type { CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import type { ResolvedCreateTodoData } from "../ports/staged-todo-creator.port.js";
import type { CreatedOccurrence, TodoRepositoryPort } from "../ports/todo.repository.port.js";
import {
  categoryTodoLimitReached,
  invalidRepeatRule,
  recurringTodoCategoryLimitReached,
  todoSeriesLimitReached,
} from "../todos.errors.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

/** 잠금 전에 검증을 마친 단일 할 일 입력. 제목·일정 오류가 소유·한도 오류보다 먼저다. */
export interface SingleTodoSpec {
  readonly userId: UserId;
  readonly categoryId: TodoCategoryId;
  readonly title: TodoTitle;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
}

export function toSingleTodoSpec(input: ResolvedCreateTodoData): SingleTodoSpec {
  return {
    userId: input.userId,
    categoryId: input.categoryId,
    title: TodoTitle.create(input.title),
    schedule: TodoSchedule.create({
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      scheduledLocalTime: input.scheduledTime ?? null,
      isAllDay: input.isAllDay ?? true,
      timezone: input.timezone,
    }),
    visibility: input.visibility ?? "PUBLIC",
  };
}

export interface CreatedTodo {
  readonly todo: Todo;
  /** 트랜잭션 안에서 반영한 사실. 옛 todo.* 이벤트로 커밋 뒤 다시 낸다. */
  readonly events: readonly TodoEvent[];
}

export interface StartedSeries {
  readonly series: TodoSeries;
  readonly occurrences: readonly CreatedOccurrence[];
}

interface TodoCreationWriterDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "countCategoryUsage" | "getMaxSortOrder" | "nextId" | "insert" | "createInlineItems"
  >;
  readonly todoSeriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId" | "insert">;
  readonly occurrenceMaterializer: Pick<
    MaterializeTodoOccurrencesUseCase,
    "planFirstRun" | "persist"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly clock: ClockPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

export class WriteTodoCreationUseCase {
  readonly #dependencies: TodoCreationWriterDependencies;

  constructor(dependencies: TodoCreationWriterDependencies) {
    this.#dependencies = dependencies;
  }

  async createSingle(
    spec: SingleTodoSpec,
    items?: readonly { title: string }[],
  ): Promise<CreatedTodo> {
    const { todoRepository } = this.#dependencies;
    await this.#dependencies.categoryOwnership.validateOwnership(spec.categoryId, spec.userId);
    const activeCount = await todoRepository.countCategoryUsage(spec.userId, spec.categoryId);
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw categoryTodoLimitReached(activeCount);
    }
    const maxSortOrder = await todoRepository.getMaxSortOrder(spec.userId);
    const todo = Todo.create({
      id: await todoRepository.nextId(),
      userId: spec.userId,
      categoryId: spec.categoryId.value,
      title: spec.title,
      schedule: spec.schedule,
      visibility: spec.visibility,
      sortOrder: maxSortOrder + 1,
      now: this.#dependencies.clock.now(),
    });
    await todoRepository.insert(todo);
    if (items != null && items.length > 0) {
      await todoRepository.createInlineItems(todo.id, items);
    }
    // 리마인더 예약과 planning.todo.created는 행과 함께 커밋한다. 옛 todo.created는 커밋 뒤 따로 나간다
    const events = todo.pullDomainEvents();
    await this.#dependencies.applyTodoEvents.execute(events);
    return { todo, events };
  }

  /** 상한 확인 → 규칙 저장 → 회차를 한 번에 만든다. 활성 UoW와 생성 잠금 안에서 호출한다. */
  async startSeries(input: ResolvedCreateTodoData, repeat: RepeatSpec): Promise<StartedSeries> {
    const { userId, categoryId } = input;
    if (input.endDate != null) {
      throw invalidRepeatRule("endDate");
    }
    const now = this.#dependencies.clock.now();
    // 옛 순서 그대로 규칙 → 제목 → 체크리스트 순으로 검증한다
    const rule = RepeatRule.create(repeat);
    const title = TodoTitle.create(input.title);
    const series = TodoSeries.create({
      id: TodoSeriesId.generate(),
      userId,
      categoryId: categoryId.value,
      title,
      visibility: input.visibility ?? "PUBLIC",
      scheduledLocalTime: input.scheduledTime ?? null,
      timezone: input.timezone,
      rule,
      startDate: input.startDate.toString(),
      checklistTemplate: input.items ?? [],
      now,
    });
    series.assertWithinPastLimit(now);
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);
    await this.#assertSeriesLimit(userId, input.usesLegacySeriesLimit === true);
    const activeInCategory = await this.#dependencies.todoRepository.countCategoryUsage(
      userId,
      categoryId,
    );
    if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw recurringTodoCategoryLimitReached(activeInCategory, TODO_LIMITS.MAX_PER_CATEGORY);
    }
    const drafts = this.#dependencies.occurrenceMaterializer.planFirstRun(series, now);
    await this.#dependencies.todoSeriesRepository.insert(series);
    const occurrences = await this.#dependencies.occurrenceMaterializer.persist(series, drafts);
    return { series, occurrences };
  }

  async #assertSeriesLimit(userId: UserId, usesLegacyLimit: boolean): Promise<void> {
    const limit = usesLegacyLimit
      ? TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY
      : TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER;
    const activeCount = await this.#dependencies.todoSeriesRepository.countActiveByUserId(userId);
    if (activeCount < limit) {
      return;
    }
    if (usesLegacyLimit) {
      // 출시 앱은 TODO_0842를 몰라 SYS_0001로 보인다. 이 경로에서 이미 받는 한도 거절로 돌려준다.
      throw recurringTodoCategoryLimitReached(activeCount, limit);
    }
    throw todoSeriesLimitReached(limit, activeCount);
  }
}
