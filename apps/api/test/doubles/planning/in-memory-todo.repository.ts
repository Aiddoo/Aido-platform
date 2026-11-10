import type { TodoVisibility } from "@aido/api/vocabulary";
import { isUndefined, omitBy } from "es-toolkit";

import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import { TodoItemId } from "#api/modules/planning/shared/domain/todo-item-id.vo";
import type { TodoItem } from "#api/modules/planning/shared/domain/todo-item.entity";
import type { TodoScheduleProps } from "#api/modules/planning/shared/domain/todo-schedule.vo";
import { Todo } from "#api/modules/planning/shared/domain/todo.aggregate";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import {
  type CreatedOccurrence,
  type OccurrencePatch,
  type OccurrenceRow,
  type OccurrenceTime,
  type RebaseCandidate,
  type RebaseCandidateQuery,
  type RebasedInstant,
  type TodoOccurrenceAttachment,
  type TodoOccurrencePlan,
  TodoRepositoryPort,
  type TodoUpdatePatch,
} from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { TodoBuilder } from "#test/builders/index";
import { type PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

// Temporal 값은 바뀌지 않아 structuredClone 대신 행과 하위 항목만 복사한다
export function copyTodoRecord(record: PlanningTodoRecord): PlanningTodoRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
    category: record.category == null ? null : { ...record.category },
  };
}

export class InMemoryTodoRepository extends TodoRepositoryPort {
  readonly records: Map<number, PlanningTodoRecord>;
  readonly seriesStore: Map<string, TodoSeries>;

  constructor(
    records: Map<number, PlanningTodoRecord>,
    seriesStore: Map<string, TodoSeries> = new Map(),
  ) {
    super();
    this.records = records;
    this.seriesStore = seriesStore;
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const saved = this.records.get(id);
    if (saved === undefined || saved.userId !== userId) {
      return null;
    }
    return Todo.reconstitute(copyTodoRecord(saved));
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
      ...primitives,
      items: [],
    });
  }

  async insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: string,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]> {
    const created: CreatedOccurrence[] = [];
    for (const plan of plans) {
      const occurrenceDate = Temporal.PlainDate.from(plan.occurrenceDate);
      const exists = [...this.records.values()].some(
        (record) => record.seriesId === seriesId && record.occurrenceDate?.equals(occurrenceDate),
      );
      if (exists) {
        continue;
      }
      const id = plan.id.value;
      this.records.set(id, {
        ...TodoBuilder.create(plan.userId).withId(id).build(),
        ...plan,
        id,
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
          record.occurrenceDate.toString() >= fromDate,
      )
      .map((record) => ({
        todoId: record.id,
        seriesId: record.seriesId ?? "",
        occurrenceDate: (record.occurrenceDate ?? record.startDate).toString(),
        startDate: record.startDate.toString(),
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
    const date = Temporal.PlainDate.from(occurrence.occurrenceDate);
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
                startDate: record.startDate.toString(),
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
    const date = Temporal.PlainDate.from(occurrence.occurrenceDate);
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
            (record.occurrenceDate != null && record.occurrenceDate.toString() >= fromDate)),
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
        createdAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      });
    }
  }
  async updateCompletion(
    id: number,
    completed: boolean,
    completedAt: Temporal.Instant | null,
  ): Promise<void> {
    Object.assign(this.#record(id), { completed, completedAt });
  }
  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    Object.assign(this.#record(id), omitBy(patch, isUndefined));
  }
  async updateTitle(id: number, title: string): Promise<void> {
    this.#record(id).title = title;
  }
  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    this.#record(id).visibility = visibility;
  }
  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    Object.assign(this.#record(id), { ...schedule });
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
      createdAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    });
  }

  async insertItem(todoId: number, item: TodoItem): Promise<void> {
    this.#record(todoId).items.push(item.toPrimitives());
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
