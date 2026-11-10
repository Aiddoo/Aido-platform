import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { TodoVisibility } from "@aido/api/vocabulary";
import { isUndefined, omitBy } from "es-toolkit";

import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import { TodoItemId } from "#api/modules/planning/shared/domain/todo-item-id.vo";
import type { TodoItem } from "#api/modules/planning/shared/domain/todo-item.entity";
import type { TodoScheduleProps } from "#api/modules/planning/shared/domain/todo-schedule.vo";
import { Todo } from "#api/modules/planning/shared/domain/todo.aggregate";
import type { TodoSeriesOwnerPort } from "#api/modules/planning/todo-series/application/ports/todo-series-owner.port";
import type {
  TodoSeriesRef,
  DueTodoSeriesQuery,
  TodoSeriesRepositoryPort,
} from "#api/modules/planning/todo-series/application/ports/todo-series.repository.port";
import type { SeriesOwnerActivity } from "#api/modules/planning/todo-series/domain/series-dormancy.domain-service";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import type { TodoCachePort } from "#api/modules/planning/todos/application/ports/todo-cache.port";
import type { TodoOwnerTimezonePort } from "#api/modules/planning/todos/application/ports/todo-owner-timezone.port";
import type {
  FindFriendTodosParams,
  FindTodosParams,
} from "#api/modules/planning/todos/application/ports/todo-read.repository.port";
import type {
  TodoReadRepositoryPort,
  TodaySummaryTodoRow,
} from "#api/modules/planning/todos/application/ports/todo-read.repository.port";
import type {
  TodoReminderSchedulerPort,
  TodoReminderSchedule,
} from "#api/modules/planning/todos/application/ports/todo-reminder-scheduler.port";
import type {
  CreatedOccurrence,
  OccurrencePatch,
  OccurrenceRow,
  OccurrenceTime,
  RebaseCandidate,
  RebaseCandidateQuery,
  RebasedInstant,
  TodoOccurrenceAttachment,
  TodoOccurrencePlan,
  TodoRepositoryPort,
  TodoUpdatePatch,
} from "#api/modules/planning/todos/application/ports/todo.repository.port";
import type {
  FriendTodoReadModel,
  TodoReadModel,
} from "#api/modules/planning/todos/application/read-models/todo.read-model";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type {
  DomainEventPublisherPort,
  MutationLockPort,
  PublishedDomainEvent,
} from "#api/shared/application/ports/index";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { TodoBuilder } from "#test/builders/index";
import {
  createTodoReadModelFromRecord,
  type PlanningTodoRecord,
} from "#test/fixtures/todo-response.fixture";

export class StubPlanningTodoRepository implements TodoRepositoryPort {
  constructor(
    readonly records: Map<number, PlanningTodoRecord>,
    readonly seriesStore: Map<string, TodoSeries> = new Map(),
  ) {}

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const saved = this.records.get(id);
    if (saved === undefined || saved.userId !== userId) {
      return null;
    }
    const record = structuredClone(saved);
    return Todo.reconstitute({
      ...record,
      completedAt: record.completedAt == null ? null : instantFromDate(record.completedAt),
      items: record.items.map((item) => ({
        ...item,
        createdAt: instantFromDate(item.createdAt),
        updatedAt: instantFromDate(item.updatedAt),
      })),
      createdAt: instantFromDate(record.createdAt),
      updatedAt: instantFromDate(record.updatedAt),
    });
  }

  #sequence = 0;
  #itemSequence = 0;

  async nextId(): Promise<TodoId> {
    this.#sequence = Math.max(this.#sequence, ...this.records.keys()) + 1;
    return TodoId.reconstitute(this.#sequence);
  }

  async nextIds(count: number): Promise<TodoId[]> {
    const ids: TodoId[] = [];
    for (let index = 0; index < count; index += 1) {
      ids.push(await this.nextId());
    }
    return ids;
  }

  async nextItemId(): Promise<TodoItemId> {
    this.#itemSequence =
      Math.max(
        this.#itemSequence,
        ...[...this.records.values()].flatMap((record) => record.items.map((item) => item.id)),
      ) + 1;
    return TodoItemId.reconstitute(this.#itemSequence);
  }

  async insert(todo: Todo): Promise<void> {
    const primitives = todo.toPrimitives();
    this.records.set(primitives.id, {
      ...TodoBuilder.create(primitives.userId).withId(primitives.id).build(),
      ...structuredClone({
        ...primitives,
        completedAt: primitives.completedAt == null ? null : instantToDate(primitives.completedAt),
        items: [],
        createdAt: instantToDate(primitives.createdAt),
        updatedAt: instantToDate(primitives.updatedAt),
      }),
    });
  }

  async insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: string,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]> {
    const created: CreatedOccurrence[] = [];
    for (const plan of plans) {
      const occurrenceDate = parseDateOnly(plan.occurrenceDate);
      const exists = [...this.records.values()].some(
        (record) =>
          record.seriesId === seriesId &&
          record.occurrenceDate?.getTime() === occurrenceDate.getTime(),
      );
      if (exists) {
        continue;
      }
      const id = plan.id.value;
      this.records.set(id, {
        ...TodoBuilder.create(plan.userId).withId(id).build(),
        ...structuredClone({ ...plan, id, createdAt: instantToDate(plan.createdAt) }),
        seriesId,
        occurrenceDate,
      });
      await this.createInlineItems(id, checklist);
      created.push({ todoId: id, scheduledTime: plan.scheduledTime });
    }
    return created;
  }

  async findOccurrencesFrom(
    seriesIds: readonly string[],
    fromDate: string,
  ): Promise<readonly OccurrenceRow[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.seriesId != null &&
          seriesIds.includes(record.seriesId) &&
          record.occurrenceDate !== null &&
          toDateString(record.occurrenceDate) >= fromDate,
      )
      .map((record) => ({
        todoId: record.id,
        seriesId: record.seriesId ?? "",
        occurrenceDate: toDateString(record.occurrenceDate ?? record.startDate),
        startDate: toDateString(record.startDate),
        completed: record.completed,
      }))
      .sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate));
  }
  async updateFollowingOccurrences(
    seriesId: string,
    fromDate: string,
    patch: OccurrencePatch,
  ): Promise<void> {
    for (const row of await this.findOccurrencesFrom([seriesId], fromDate)) {
      if (!row.completed) {
        Object.assign(this.#record(row.todoId), omitBy(patch, isUndefined));
      }
    }
  }
  async updateOccurrenceTimes(times: readonly OccurrenceTime[]): Promise<void> {
    for (const { todoId, scheduledLocalTime, scheduledTime } of times) {
      Object.assign(this.#record(todoId), {
        scheduledLocalTime,
        scheduledTime,
        isAllDay: scheduledTime === null,
      });
    }
  }
  async reassignOccurrences(todoIds: readonly number[], toSeriesId: string): Promise<void> {
    for (const todoId of todoIds) {
      this.#record(todoId).seriesId = toSeriesId;
    }
  }
  async moveOccurrence(todoId: number, occurrence: TodoOccurrenceAttachment): Promise<void> {
    const date = parseDateOnly(occurrence.occurrenceDate);
    Object.assign(this.#record(todoId), {
      occurrenceDate: date,
      startDate: date,
      scheduledLocalTime: occurrence.scheduledLocalTime,
      scheduledTime: occurrence.scheduledTime,
    });
  }
  async lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.userId === query.userId &&
          record.scheduledTime != null &&
          (query.afterId == null || record.id > query.afterId),
      )
      .sort((left, right) => left.id - right.id)
      .slice(0, query.limit)
      .flatMap((record) =>
        record.scheduledTime == null
          ? []
          : [
              {
                todoId: record.id,
                startDate: toDateString(record.startDate),
                scheduledLocalTime: record.scheduledLocalTime,
                scheduledTime: record.scheduledTime,
                completed: record.completed,
              },
            ],
      );
  }
  async updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void> {
    for (const { todoId, scheduledTime } of instants) {
      this.#record(todoId).scheduledTime = scheduledTime;
    }
  }
  async attachToSeries(
    todoId: number,
    seriesId: string,
    occurrence: TodoOccurrenceAttachment,
  ): Promise<void> {
    const date = parseDateOnly(occurrence.occurrenceDate);
    Object.assign(this.#record(todoId), {
      seriesId,
      occurrenceDate: date,
      startDate: date,
      endDate: null,
      scheduledLocalTime: occurrence.scheduledLocalTime,
      scheduledTime: occurrence.scheduledTime,
      isAllDay: occurrence.scheduledTime === null,
    });
  }
  async deleteOccurrences(query: {
    readonly userId: string;
    readonly seriesIds: readonly string[];
    readonly fromDate?: string;
    readonly includeCompleted: boolean;
  }): Promise<readonly number[]> {
    const { fromDate } = query;
    const ids = [...this.records.values()]
      .filter(
        (record) =>
          record.seriesId != null &&
          query.seriesIds.includes(record.seriesId) &&
          (query.includeCompleted || !record.completed) &&
          (fromDate == null ||
            (record.occurrenceDate != null && toDateString(record.occurrenceDate) >= fromDate)),
      )
      .map((record) => record.id);
    await this.deleteMany(ids);
    return ids;
  }
  async deleteMany(todoIds: readonly number[]): Promise<void> {
    for (const todoId of todoIds) {
      this.records.delete(todoId);
    }
  }
  async createInlineItems(todoId: number, items: readonly { title: string }[]): Promise<void> {
    for (const [sortOrder, item] of items.entries()) {
      const id = (await this.nextItemId()).value;
      this.#record(todoId).items.push({
        id,
        ...item,
        sortOrder,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
  async updateCompletion(id: number, completed: boolean, completedAt: Date | null): Promise<void> {
    Object.assign(this.#record(id), { completed, completedAt: structuredClone(completedAt) });
  }
  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    const { completedAt, ...values } = patch;
    Object.assign(
      this.#record(id),
      structuredClone(
        Object.fromEntries(
          Object.entries(values).filter(([_fieldName, value]) => value !== undefined),
        ),
      ),
      // nullish-strict: null은 완료 시각 지우기다
      completedAt === undefined
        ? {}
        : { completedAt: completedAt == null ? null : instantToDate(completedAt) },
    );
  }
  async updateTitle(id: number, title: string): Promise<void> {
    this.#record(id).title = title;
  }
  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    this.#record(id).visibility = visibility;
  }
  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    Object.assign(this.#record(id), structuredClone(schedule));
  }
  async updateCategory(id: number, categoryId: number): Promise<void> {
    this.#record(id).categoryId = categoryId;
  }
  async delete(id: number): Promise<void> {
    this.records.delete(id);
  }
  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    this.#record(id).sortOrder = sortOrder;
  }
  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    for (const record of this.records.values()) {
      if (
        record.userId === userId &&
        record.sortOrder >= from &&
        (to === null || record.sortOrder <= to)
      ) {
        record.sortOrder += delta;
      }
    }
  }
  async countCategoryUsage(userId: string, categoryId: number): Promise<number> {
    const activeSeries = [...this.seriesStore.values()].filter(
      (series) =>
        series.userId.value === userId && series.categoryId === categoryId && series.isActive,
    ).length;
    return (
      activeSeries +
      [...this.records.values()].filter(
        (record) =>
          record.userId === userId &&
          record.categoryId === categoryId &&
          !record.completed &&
          record.seriesId === null,
      ).length
    );
  }
  async getMaxSortOrder(userId: string): Promise<number> {
    return Math.max(
      -1,
      ...[...this.records.values()]
        .filter((record) => record.userId === userId)
        .map((record) => record.sortOrder),
    );
  }
  async seedItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    this.#record(todoId).items.push({
      id: (await this.nextItemId()).value,
      ...data,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async insertItem(todoId: number, item: TodoItem): Promise<void> {
    const primitives = item.toPrimitives();
    this.#record(todoId).items.push({
      ...primitives,
      createdAt: instantToDate(primitives.createdAt),
      updatedAt: instantToDate(primitives.updatedAt),
    });
  }
  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    const item = [...this.records.values()]
      .flatMap((record) => record.items)
      .find((entry) => entry.id === itemId);
    if (item === undefined) {
      throw new Error("Todo item fixture is missing");
    }
    Object.assign(
      item,
      Object.fromEntries(Object.entries(data).filter(([_fieldName, value]) => value !== undefined)),
    );
  }
  async deleteItem(itemId: number): Promise<void> {
    for (const record of this.records.values()) {
      record.items = record.items.filter((item) => item.id !== itemId);
    }
  }
  async reorderItems(itemIds: number[]): Promise<void> {
    for (const [sortOrder, id] of itemIds.entries()) {
      const item = [...this.records.values()]
        .flatMap((record) => record.items)
        .find((entry) => entry.id === id);
      if (item !== undefined) {
        item.sortOrder = sortOrder;
      }
    }
    for (const record of this.records.values()) {
      record.items.sort((left, right) => left.sortOrder - right.sortOrder);
    }
  }
  #record(id: number): PlanningTodoRecord {
    const record = this.records.get(id);
    if (record === undefined) {
      throw new Error("Todo fixture is missing");
    }
    return record;
  }
}

/** 저장한 규칙을 메모리에 두고 복원해 돌려주는 Fake. 잠금은 흉내 내지 않는다. */
export class StubPlanningTodoSeriesOwner implements TodoSeriesOwnerPort {
  /** 비워 두면 소유자가 방금 활동한 것으로 읽는다. */
  activity: SeriesOwnerActivity | null = null;
  readonly exemptUserIds = new Set<string>();
  /** 정지·탈퇴 대기 계정 */
  readonly suspendedUserIds = new Set<string>();
  async findOperatingOwners(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    return new Map(
      userIds
        .filter((userId) => !this.suspendedUserIds.has(userId))
        .map((userId) => [
          userId,
          this.activity ?? {
            lastActiveAt: new Date(),
            signedUpAt: new Date(),
            timezone: "UTC",
          },
        ]),
    );
  }
  async isExemptFromDormancy(userId: string): Promise<boolean> {
    return this.exemptUserIds.has(userId);
  }
}

export class StubPlanningTodoOwnerTimezone implements TodoOwnerTimezonePort {
  constructor(readonly timezones: Map<string, string> = new Map()) {}
  async findTimezone(userId: string): Promise<string | null> {
    return this.timezones.get(userId) ?? null;
  }
}

export class StubPlanningTodoSeriesRepository implements TodoSeriesRepositoryPort {
  constructor(readonly store: Map<string, TodoSeries> = new Map()) {}
  async updateTimezoneByUserId(userId: string, timezone: string): Promise<number> {
    const owned = [...this.store.values()].filter(
      (series) => series.userId.value === userId && series.timezone !== timezone,
    );
    for (const series of owned) {
      series.applyDetails({ timezone });
    }
    return owned.length;
  }
  async findByIdAndUserId(id: string, userId: string): Promise<TodoSeries | null> {
    const series = this.store.get(id);
    return series === undefined || series.userId.value !== userId ? null : this.#copy(series);
  }
  async lockForUpdate(id: string): Promise<TodoSeries | null> {
    const series = this.store.get(id);
    return series === undefined ? null : this.#copy(series);
  }
  async insert(series: TodoSeries): Promise<void> {
    this.store.set(series.id.value, this.#copy(series));
  }
  async update(series: TodoSeries): Promise<void> {
    this.store.set(series.id.value, this.#copy(series));
  }
  async lockFamilyIds(userId: string, originSeriesId: string): Promise<readonly string[]> {
    return [...this.store.values()]
      .filter(
        (series) =>
          series.userId.value === userId && series.originSeriesId.value === originSeriesId,
      )
      .map((series) => series.id.value);
  }
  async lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]> {
    return [...this.store.values()]
      .filter(
        (segment) =>
          segment.userId.value === series.userId.value &&
          segment.originSeriesId.value === series.originSeriesId.value &&
          segment.startDate >= series.startDate &&
          segment.id.value !== series.id.value,
      )
      .map((segment) => this.#copy(segment));
  }
  async deleteMany(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.store.delete(id);
    }
  }
  async countActiveByUserId(userId: string): Promise<number> {
    return [...this.store.values()].filter(
      (series) => series.userId.value === userId && series.isActive,
    ).length;
  }
  async findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]> {
    return [...this.store.values()]
      .filter((series) => {
        const next = series.nextOccurrenceDate;
        return (
          next !== null &&
          next <= query.through &&
          (query.afterId === null || series.id.value > query.afterId)
        );
      })
      .map((series) => ({
        id: series.id.value,
        userId: series.userId.value,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, query.limit);
  }
  async findIdsBehind(userId: string, through: string): Promise<readonly string[]> {
    return [...this.store.values()]
      .filter((series) => {
        const next = series.nextOccurrenceDate;
        return series.userId.value === userId && next !== null && next <= through;
      })
      .map((series) => series.id.value);
  }
  #copy(series: TodoSeries): TodoSeries {
    return TodoSeries.reconstitute(series.toPrimitives());
  }
}

export class StubPlanningTodoReminder implements TodoReminderSchedulerPort {
  readonly scheduled: TodoReminderSchedule[] = [];
  readonly cancelled: number[] = [];
  async scheduleReminder(todoId: number, scheduledTime: Date, userId: string): Promise<void> {
    this.scheduled.push({ todoId, scheduledTime, userId });
  }
  async scheduleReminders(reminders: readonly TodoReminderSchedule[]): Promise<void> {
    this.scheduled.push(...reminders);
  }
  async cancelReminders(todoIds: readonly number[]): Promise<void> {
    this.cancelled.push(...todoIds);
  }
}

export class StubPlanningTodoReadRepository implements TodoReadRepositoryPort {
  queryResults: TodoReadModel[] = [];
  dayStats = { total: 0, completed: 0 };
  topTodos: TodaySummaryTodoRow[] = [];
  constructor(
    readonly records: Map<number, PlanningTodoRecord>,
    readonly categories: Map<number, TodoResponse["category"]>,
    readonly seriesStore: Map<string, TodoSeries> = new Map(),
  ) {}
  async findByIdAndUserId(id: number, userId: string): Promise<TodoReadModel | null> {
    const saved = this.records.get(id);
    if (saved === undefined || saved.userId !== userId) {
      return null;
    }
    const record = structuredClone(saved);
    record.items.sort((left, right) => left.sortOrder - right.sortOrder);
    record.category = this.categories.get(record.categoryId) ?? null;
    return createTodoReadModelFromRecord(record);
  }
  async findOwnerId(id: number): Promise<string | null> {
    return this.records.get(id)?.userId ?? null;
  }
  async findManyBySeriesId(userId: string, seriesId: string): Promise<TodoReadModel[]> {
    const records = [...this.records.values()]
      .filter((record) => record.userId === userId && record.seriesId === seriesId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const responses: TodoReadModel[] = [];
    for (const record of records) {
      const response = await this.findByIdAndUserId(record.id, userId);
      if (response !== null) {
        responses.push(response);
      }
    }
    return responses;
  }
  async findManyByUserId(_params: FindTodosParams): Promise<TodoReadModel[]> {
    return structuredClone(this.queryResults);
  }
  async findPublicTodosByUserId(_params: FindFriendTodosParams): Promise<FriendTodoReadModel[]> {
    return structuredClone(this.queryResults);
  }
  async countCategoryUsage(userId: string, categoryId: number): Promise<number> {
    const activeSeries = [...this.seriesStore.values()].filter(
      (series) =>
        series.userId.value === userId && series.categoryId === categoryId && series.isActive,
    ).length;
    return (
      activeSeries +
      [...this.records.values()].filter(
        (record) =>
          record.userId === userId &&
          record.categoryId === categoryId &&
          !record.completed &&
          record.seriesId === null,
      ).length
    );
  }
  async countCompletedByUser(userId: string): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.userId === userId && record.completed,
    ).length;
  }
  async getTodayTodoStats(
    _userId: string,
    _today: Date,
  ): Promise<{ total: number; completed: number }> {
    return { ...this.dayStats };
  }
  async findTodayTopTodos(
    _userId: string,
    _today: Date,
    _limit: number,
  ): Promise<TodaySummaryTodoRow[]> {
    return structuredClone(this.topTodos);
  }
}

export class StubPlanningTodoCache implements TodoCachePort {
  readonly categoryUsers = new Set<string>();
  readonly pages = new Map<string, CursorPaginatedResponse<FriendTodoReadModel, number>>();
  readonly generations = new Map<string, number>();
  async invalidateTodoCategories(userId: string): Promise<void> {
    this.categoryUsers.delete(userId);
  }
  async readFriendTodosFirstPage(userId: string, start: string, end: string, size: number) {
    const page = this.pages.get(this.#key(userId, start, end, size));
    return {
      generation: String(this.generations.get(userId) ?? 0),
      page: page === undefined ? undefined : structuredClone(page),
    };
  }
  async storeFriendTodosFirstPageIfCurrent(
    userId: string,
    start: string,
    end: string,
    size: number,
    generation: string,
    page: CursorPaginatedResponse<FriendTodoReadModel, number>,
  ): Promise<void> {
    if (generation === String(this.generations.get(userId) ?? 0)) {
      this.pages.set(this.#key(userId, start, end, size), structuredClone(page));
    }
  }
  async invalidateFriendTodos(userId: string): Promise<void> {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    for (const key of this.pages.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.pages.delete(key);
      }
    }
  }
  #key(userId: string, start: string, end: string, size: number): string {
    return `${userId}:${start}:${end}:${size}`;
  }
}

export class StubPlanningEventPublisher implements DomainEventPublisherPort {
  readonly events: DomainEvent[] = [];
  readonly publishedEvents: PublishedDomainEvent[] = [];
  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
  async publish(events: readonly PublishedDomainEvent[]): Promise<void> {
    this.publishedEvents.push(...events);
  }
}

export class StubPlanningMutationLock implements MutationLockPort {
  readonly acquired: string[][] = [];
  async acquire(keys: readonly string[]): Promise<void> {
    this.acquired.push([...keys]);
  }
}

export function createCategoryOwnershipStub(
  categories: Map<number, TodoResponse["category"]>,
  owners: Map<number, string>,
) {
  return {
    async validateOwnership(categoryId: number, userId: string): Promise<void> {
      if (!categories.has(categoryId) || owners.get(categoryId) !== userId) {
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
      }
    },
  };
}
