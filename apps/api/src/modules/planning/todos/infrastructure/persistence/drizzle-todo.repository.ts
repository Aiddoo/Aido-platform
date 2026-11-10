import type { TodoVisibility } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lte, max, sql } from "drizzle-orm";
import { isEmptyObject, isUndefined, omitBy } from "es-toolkit";

import {
  DatabaseRecordNotFoundError,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoItem, todoSeries } from "#api/platform/database/schema/index";
import { nextSequenceValue, nextSequenceValues } from "#api/platform/database/sequence";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { TodoItemId } from "../../../shared/domain/todo-item-id.vo.js";
import type { TodoItem } from "../../../shared/domain/todo-item.entity.js";
import type { TodoScheduleProps } from "../../../shared/domain/todo-schedule.vo.js";
import type { Todo } from "../../../shared/domain/todo.aggregate.js";
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
} from "../../application/ports/todo.repository.port.js";
import { toTodo, toTodoItemRow, toTodoRow } from "./todo-row.mapper.js";

type TodoPatch = Partial<typeof todo.$inferInsert>;

@Injectable()
export class DrizzleTodoRepository implements TodoRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<TodoId> {
    return TodoId.reconstitute(await nextSequenceValue(this.#db, todo.id));
  }

  async nextIds(count: number): Promise<TodoId[]> {
    if (count === 0) {
      return [];
    }
    const ids = await nextSequenceValues(this.#db, todo.id, count);
    return ids.map((id) => TodoId.reconstitute(id));
  }

  async nextItemId(): Promise<TodoItemId> {
    return TodoItemId.reconstitute(await nextSequenceValue(this.#db, todoItem.id));
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const row = await this.#db.query.todo.findFirst({
      where: { id, userId },
      with: {
        items: {
          columns: {
            id: true,
            title: true,
            completed: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return row == null ? null : toTodo(row);
  }

  async insert(entity: Todo): Promise<void> {
    await this.#db.insert(todo).values(toTodoRow(entity));
  }

  async createInlineItems(todoId: number, items: readonly { title: string }[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const updatedAt = this.#clock.now();
    await this.#db
      .insert(todoItem)
      .values(
        items.map((item, sortOrder) => ({ todoId, title: item.title, sortOrder, updatedAt })),
      );
  }

  async insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: string,
    checklist: readonly { title: string }[],
  ): Promise<readonly CreatedOccurrence[]> {
    if (plans.length === 0) {
      return [];
    }
    // 이미 있는 날짜는 건너뛰어 그 id는 쓰이지 않고 비어도 된다
    const updatedAt = this.#clock.now();
    const rows = await this.#db
      .insert(todo)
      .values(
        plans.map((plan) => ({
          ...plan,
          id: plan.id.value,
          seriesId,
          occurrenceDate: Temporal.PlainDate.from(plan.occurrenceDate),
          updatedAt,
        })),
      )
      .onConflictDoNothing({
        target: [todo.seriesId, todo.occurrenceDate],
        where: isNotNull(todo.occurrenceDate),
      })
      .returning({ id: todo.id, scheduledTime: todo.scheduledTime });
    if (rows.length > 0 && checklist.length > 0) {
      await this.#db.insert(todoItem).values(
        rows.flatMap((created) =>
          checklist.map((item, sortOrder) => ({
            todoId: created.id,
            title: item.title,
            sortOrder,
            updatedAt,
          })),
        ),
      );
    }
    return rows.map((row) => ({ todoId: row.id, scheduledTime: row.scheduledTime }));
  }

  async findOccurrencesFrom(
    seriesIds: readonly string[],
    fromDate: string,
  ): Promise<readonly OccurrenceRow[]> {
    const rows = await this.#db
      .select({
        todoId: todo.id,
        seriesId: todo.seriesId,
        occurrenceDate: todo.occurrenceDate,
        startDate: todo.startDate,
        completed: todo.completed,
      })
      .from(todo)
      .where(
        and(
          inArray(todo.seriesId, [...seriesIds]),
          gte(todo.occurrenceDate, Temporal.PlainDate.from(fromDate)),
        ),
      )
      .orderBy(asc(todo.occurrenceDate));
    return rows.map((row) => ({
      todoId: row.todoId,
      seriesId: requireRecord(row.seriesId),
      occurrenceDate: requireRecord(row.occurrenceDate).toString(),
      startDate: row.startDate.toString(),
      completed: row.completed,
    }));
  }

  async updateFollowingOccurrences(
    seriesId: string,
    fromDate: string,
    patch: OccurrencePatch,
  ): Promise<void> {
    const values = omitBy(patch, isUndefined);
    if (isEmptyObject(values)) {
      return;
    }
    await this.#db
      .update(todo)
      .set({ ...values, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(todo.seriesId, seriesId),
          gte(todo.occurrenceDate, Temporal.PlainDate.from(fromDate)),
          eq(todo.completed, false),
        ),
      );
  }

  async updateOccurrenceTimes(times: readonly OccurrenceTime[]): Promise<void> {
    if (times.length === 0) {
      return;
    }
    // 행마다 다른 값을 쓰므로 CASE 한 문장으로 갱신한다.
    const instantCases = sql.join(
      times.map(
        ({ todoId, scheduledTime }) =>
          sql`WHEN ${todoId}::integer THEN ${scheduledTime == null ? null : toIsoString(scheduledTime)}::timestamptz`,
      ),
      sql` `,
    );
    const localTimeCases = sql.join(
      times.map(
        ({ todoId, scheduledLocalTime }) =>
          sql`WHEN ${todoId}::integer THEN ${scheduledLocalTime}::varchar`,
      ),
      sql` `,
    );
    await this.#db
      .update(todo)
      .set({
        scheduledTime: sql`CASE ${todo.id} ${instantCases} END`,
        scheduledLocalTime: sql`CASE ${todo.id} ${localTimeCases} END`,
        isAllDay: times.every(({ scheduledTime }) => scheduledTime == null),
        updatedAt: this.#clock.now(),
      })
      .where(
        inArray(
          todo.id,
          times.map(({ todoId }) => todoId),
        ),
      );
  }

  async reassignOccurrences(todoIds: readonly number[], toSeriesId: string): Promise<void> {
    if (todoIds.length === 0) {
      return;
    }
    await this.#db
      .update(todo)
      .set({ seriesId: toSeriesId, updatedAt: this.#clock.now() })
      .where(inArray(todo.id, [...todoIds]));
  }

  async moveOccurrence(todoId: number, occurrence: TodoOccurrenceAttachment): Promise<void> {
    const date = Temporal.PlainDate.from(occurrence.occurrenceDate);
    await this.#updateTodoRow(todoId, {
      occurrenceDate: date,
      startDate: date,
      scheduledLocalTime: occurrence.scheduledLocalTime,
      scheduledTime: occurrence.scheduledTime,
    });
  }

  async lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]> {
    const rows = await this.#db
      .select({
        todoId: todo.id,
        startDate: todo.startDate,
        scheduledLocalTime: todo.scheduledLocalTime,
        scheduledTime: todo.scheduledTime,
        completed: todo.completed,
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, query.userId),
          isNotNull(todo.scheduledTime),
          query.afterId == null ? undefined : gt(todo.id, query.afterId),
        ),
      )
      .orderBy(asc(todo.id))
      .limit(query.limit)
      .for("update");
    return rows.map((row) => ({
      ...row,
      startDate: row.startDate.toString(),
      scheduledTime: requireRecord(row.scheduledTime),
    }));
  }

  async updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void> {
    if (instants.length === 0) {
      return;
    }
    const cases = sql.join(
      instants.map(
        ({ todoId, scheduledTime }) =>
          sql`WHEN ${todoId}::integer THEN ${toIsoString(scheduledTime)}::timestamptz`,
      ),
      sql` `,
    );
    await this.#db
      .update(todo)
      .set({ scheduledTime: sql`CASE ${todo.id} ${cases} END` })
      .where(
        inArray(
          todo.id,
          instants.map(({ todoId }) => todoId),
        ),
      );
  }

  async attachToSeries(
    todoId: number,
    seriesId: string,
    occurrence: TodoOccurrenceAttachment,
  ): Promise<void> {
    const date = Temporal.PlainDate.from(occurrence.occurrenceDate);
    await this.#updateTodoRow(todoId, {
      seriesId,
      occurrenceDate: date,
      startDate: date,
      endDate: null,
      scheduledLocalTime: occurrence.scheduledLocalTime,
      scheduledTime: occurrence.scheduledTime,
      isAllDay: occurrence.scheduledTime == null,
    });
  }

  async deleteOccurrences(query: {
    readonly userId: string;
    readonly seriesIds: readonly string[];
    readonly fromDate?: string;
    readonly includeCompleted: boolean;
  }): Promise<readonly number[]> {
    const deleted = await this.#db
      .delete(todo)
      .where(
        and(
          // seriesId만으로는 부분 유니크 인덱스를 못 타 Todo 전체를 훑는다. userId 인덱스로 좁힌다.
          eq(todo.userId, query.userId),
          inArray(todo.seriesId, [...query.seriesIds]),
          query.fromDate == null
            ? undefined
            : gte(todo.occurrenceDate, Temporal.PlainDate.from(query.fromDate)),
          query.includeCompleted ? undefined : eq(todo.completed, false),
        ),
      )
      .returning({ id: todo.id });
    return deleted.map((row) => row.id);
  }

  async deleteMany(todoIds: readonly number[]): Promise<void> {
    if (todoIds.length === 0) {
      return;
    }
    await this.#db.delete(todo).where(inArray(todo.id, [...todoIds]));
  }

  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    await this.#updateTodoRow(id, patch);
  }

  async updateTitle(id: number, title: string): Promise<void> {
    await this.updateDetails(id, { title });
  }

  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    await this.updateDetails(id, { visibility });
  }

  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    await this.updateDetails(id, schedule);
  }

  async updateCategory(id: number, categoryId: number): Promise<void> {
    await this.updateDetails(id, { categoryId });
  }

  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    await this.#updateTodoRow(id, { sortOrder });
  }

  async #updateTodoRow(id: number, patch: TodoPatch): Promise<void> {
    const values = omitBy(patch, isUndefined);
    if (isEmptyObject(values)) {
      requireRecord(await this.#db.query.todo.findFirst({ columns: { id: true }, where: { id } }));
      return;
    }
    const updated = await this.#db
      .update(todo)
      .set({ ...values, updatedAt: this.#clock.now() })
      .where(eq(todo.id, id))
      .returning({ id: todo.id });
    requireRecord(updated[0]);
  }

  async delete(id: number): Promise<void> {
    const deleted = await this.#db.delete(todo).where(eq(todo.id, id)).returning({ id: todo.id });
    requireRecord(deleted[0]);
  }

  async countCategoryUsage(userId: string, categoryId: number): Promise<number> {
    const todos = await this.#db.$count(
      todo,
      and(
        eq(todo.userId, userId),
        eq(todo.categoryId, categoryId),
        eq(todo.completed, false),
        isNull(todo.seriesId),
      ),
    );
    const series = await this.#db.$count(
      todoSeries,
      and(
        eq(todoSeries.userId, userId),
        eq(todoSeries.categoryId, categoryId),
        isNotNull(todoSeries.nextOccurrenceDate),
      ),
    );
    return todos + series;
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const [result] = await this.#db
      .select({ maximum: max(todo.sortOrder) })
      .from(todo)
      .where(eq(todo.userId, userId));
    return result?.maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    await this.#db
      .update(todo)
      .set({ sortOrder: sql`${todo.sortOrder} + ${delta}`, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(todo.userId, userId),
          gte(todo.sortOrder, from),
          to == null ? undefined : lte(todo.sortOrder, to),
        ),
      );
  }

  async insertItem(todoId: number, item: TodoItem): Promise<void> {
    await this.#db.insert(todoItem).values(toTodoItemRow(todoId, item));
  }

  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    const values = omitBy(data, isUndefined);
    if (isEmptyObject(values)) {
      requireRecord(
        await this.#db.query.todoItem.findFirst({ columns: { id: true }, where: { id: itemId } }),
      );
      return;
    }
    const updated = await this.#db
      .update(todoItem)
      .set({ ...values, updatedAt: this.#clock.now() })
      .where(eq(todoItem.id, itemId))
      .returning({ id: todoItem.id });
    requireRecord(updated[0]);
  }

  async deleteItem(itemId: number): Promise<void> {
    const deleted = await this.#db
      .delete(todoItem)
      .where(eq(todoItem.id, itemId))
      .returning({ id: todoItem.id });
    requireRecord(deleted[0]);
  }

  async reorderItems(itemIds: readonly number[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }
    // 행마다 다른 값을 쓰므로 CASE 한 문장으로 요청 순서를 갱신한다.
    const orders = sql.join(
      itemIds.map((id, sortOrder) => sql`WHEN ${id}::integer THEN ${sortOrder}::integer`),
      sql` `,
    );
    const updated = await this.#db
      .update(todoItem)
      .set({ sortOrder: sql`CASE ${todoItem.id} ${orders} END`, updatedAt: this.#clock.now() })
      .where(inArray(todoItem.id, [...itemIds]))
      .returning({ id: todoItem.id });
    if (updated.length !== itemIds.length) {
      throw new DatabaseRecordNotFoundError();
    }
  }
}
