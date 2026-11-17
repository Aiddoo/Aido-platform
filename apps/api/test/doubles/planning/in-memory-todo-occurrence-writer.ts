import { isUndefined, omitBy } from "es-toolkit";

import type { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import {
  type CreatedOccurrence,
  type TodoOccurrenceDeletion,
  type TodoOccurrenceMove,
  type TodoOccurrencePatch,
  type TodoOccurrencePlan,
  type TodoOccurrenceTime,
  TodoOccurrenceWriterPort,
} from "#api/modules/planning/todos/application/ports/todo-occurrence-writer.port";
import type { TodoOccurrenceReadModel } from "#api/modules/planning/todos/application/read-models/todo-occurrence.read-model";
import { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import { TodoBuilder } from "#test/builders/index";
import { InMemoryTodoSequence } from "#test/doubles/planning/in-memory-todo.repository";
import { type PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

export class InMemoryTodoOccurrenceWriter extends TodoOccurrenceWriterPort {
  readonly records: Map<number, PlanningTodoRecord>;
  readonly sequence: InMemoryTodoSequence;

  constructor(
    records: Map<number, PlanningTodoRecord>,
    sequence: InMemoryTodoSequence = new InMemoryTodoSequence(),
  ) {
    super();
    this.records = records;
    this.sequence = sequence;
  }

  async nextIds(count: number): Promise<TodoId[]> {
    return Array.from({ length: count }, () =>
      TodoId.reconstitute(this.sequence.nextTodoId(this.records)),
    );
  }

  async insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    series: TodoSeriesId,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]> {
    const seriesId = series.value;
    const created: CreatedOccurrence[] = [];
    for (const plan of plans) {
      const { occurrenceDate } = plan;
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
        items: checklist.map((item, sortOrder) => ({
          id: this.sequence.nextItemId(this.records),
          title: item.title,
          completed: false,
          sortOrder,
          createdAt: plan.createdAt,
          updatedAt: plan.createdAt,
        })),
      });
      created.push({ todoId: plan.id, scheduledTime: plan.scheduledTime });
    }
    return created;
  }

  async findOccurrencesFrom(
    seriesIds: readonly TodoSeriesId[],
    fromDate: string,
  ): Promise<readonly TodoOccurrenceReadModel[]> {
    const ids = seriesIds.map((seriesId) => seriesId.value);
    return [...this.records.values()]
      .filter(
        (record) =>
          record.seriesId != null &&
          ids.includes(record.seriesId) &&
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
    seriesId: TodoSeriesId,
    fromDate: string,
    patch: TodoOccurrencePatch,
  ): Promise<void> {
    const values = omitBy(
      { title: patch.title, categoryId: patch.categoryId?.value, visibility: patch.visibility },
      isUndefined,
    );
    for (const row of await this.findOccurrencesFrom([seriesId], fromDate)) {
      if (!row.completed) {
        Object.assign(this.#record(row.todoId), values);
      }
    }
  }

  async updateOccurrenceTimes(times: readonly TodoOccurrenceTime[]): Promise<void> {
    for (const { todoId, scheduledLocalTime, scheduledTime } of times) {
      Object.assign(this.#record(todoId.value), {
        scheduledLocalTime,
        scheduledTime,
        isAllDay: scheduledTime === null,
      });
    }
  }

  async reassignOccurrences(todoIds: readonly TodoId[], toSeriesId: TodoSeriesId): Promise<void> {
    for (const todoId of todoIds) {
      this.#record(todoId.value).seriesId = toSeriesId.value;
    }
  }

  async moveOccurrence(todoId: TodoId, move: TodoOccurrenceMove): Promise<void> {
    const date = Temporal.PlainDate.from(move.occurrenceDate);
    Object.assign(this.#record(todoId.value), {
      occurrenceDate: date,
      startDate: date,
      scheduledLocalTime: move.scheduledLocalTime,
      scheduledTime: move.scheduledTime,
    });
  }

  async deleteOccurrences(deletion: TodoOccurrenceDeletion): Promise<readonly number[]> {
    const { fromDate } = deletion;
    const seriesIds = deletion.seriesIds.map((seriesId) => seriesId.value);
    const ids = [...this.records.values()]
      .filter(
        (record) =>
          record.userId === deletion.userId.value &&
          record.seriesId != null &&
          seriesIds.includes(record.seriesId) &&
          (deletion.includeCompleted || !record.completed) &&
          (fromDate == null ||
            (record.occurrenceDate != null && record.occurrenceDate.toString() >= fromDate)),
      )
      .map((record) => record.id);
    await this.deleteMany(ids.map((id) => TodoId.reconstitute(id)));
    return ids;
  }

  async deleteMany(todoIds: readonly TodoId[]): Promise<void> {
    for (const todoId of todoIds) {
      this.records.delete(todoId.value);
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
