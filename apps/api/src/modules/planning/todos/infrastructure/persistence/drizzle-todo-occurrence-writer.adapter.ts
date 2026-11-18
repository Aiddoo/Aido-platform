import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { isEmptyObject, isUndefined, omitBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoItem } from "#api/platform/database/schema/index";
import { nextSequenceValues } from "#api/platform/database/sequence";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { TodoSeriesId } from "../../../todo-series/domain/todo-series-id.vo.js";
import type {
  CreatedOccurrence,
  TodoOccurrenceDeletion,
  TodoOccurrenceMove,
  TodoOccurrencePatch,
  TodoOccurrencePlan,
  TodoOccurrenceTime,
  TodoOccurrenceWriterPort,
} from "../../application/ports/todo-occurrence-writer.port.js";
import type { TodoOccurrenceReadModel } from "../../application/read-models/todo-occurrence.read-model.js";
import { TodoId } from "../../domain/todo-id.vo.js";

@Injectable()
export class DrizzleTodoOccurrenceWriterAdapter implements TodoOccurrenceWriterPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#transactionHost = transactionHost;
    this.#clock = clock;
  }

  async nextIds(count: number): Promise<TodoId[]> {
    if (count === 0) {
      return [];
    }
    const ids = await nextSequenceValues(this.#db, todo.id, count);
    return ids.map((id) => TodoId.reconstitute(id));
  }

  async insertOccurrences(
    plans: readonly TodoOccurrencePlan[],
    seriesId: TodoSeriesId,
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
          seriesId: seriesId.value,
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
    return rows.map((row) => ({
      todoId: TodoId.reconstitute(row.id),
      scheduledTime: row.scheduledTime,
    }));
  }

  async findOccurrencesFrom(
    seriesIds: readonly TodoSeriesId[],
    fromDate: string,
  ): Promise<readonly TodoOccurrenceReadModel[]> {
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
          inArray(
            todo.seriesId,
            seriesIds.map((seriesId) => seriesId.value),
          ),
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
    seriesId: TodoSeriesId,
    fromDate: string,
    patch: TodoOccurrencePatch,
  ): Promise<number> {
    const values = omitBy(
      { title: patch.title, categoryId: patch.categoryId?.value, visibility: patch.visibility },
      isUndefined,
    );
    if (isEmptyObject(values)) {
      return 0;
    }
    const updated = await this.#db
      .update(todo)
      .set({ ...values, updatedAt: this.#clock.now() })
      .where(
        and(
          eq(todo.seriesId, seriesId.value),
          gte(todo.occurrenceDate, Temporal.PlainDate.from(fromDate)),
          eq(todo.completed, false),
        ),
      )
      .returning({ id: todo.id });
    return updated.length;
  }

  async updateOccurrenceTimes(times: readonly TodoOccurrenceTime[]): Promise<void> {
    if (times.length === 0) {
      return;
    }
    // 행마다 다른 값을 쓰므로 CASE 한 문장으로 갱신한다
    const instantCases = sql.join(
      times.map(
        ({ todoId, scheduledTime }) =>
          sql`WHEN ${todoId.value}::integer THEN ${scheduledTime == null ? null : toIsoString(scheduledTime)}::timestamptz`,
      ),
      sql` `,
    );
    const localTimeCases = sql.join(
      times.map(
        ({ todoId, scheduledLocalTime }) =>
          sql`WHEN ${todoId.value}::integer THEN ${scheduledLocalTime}::varchar`,
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
          times.map(({ todoId }) => todoId.value),
        ),
      );
  }

  async reassignOccurrences(todoIds: readonly TodoId[], toSeriesId: TodoSeriesId): Promise<void> {
    if (todoIds.length === 0) {
      return;
    }
    await this.#db
      .update(todo)
      .set({ seriesId: toSeriesId.value, updatedAt: this.#clock.now() })
      .where(
        inArray(
          todo.id,
          todoIds.map((todoId) => todoId.value),
        ),
      );
  }

  async moveOccurrence(todoId: TodoId, move: TodoOccurrenceMove): Promise<void> {
    const date = Temporal.PlainDate.from(move.occurrenceDate);
    const [updated] = await this.#db
      .update(todo)
      .set({
        occurrenceDate: date,
        startDate: date,
        scheduledLocalTime: move.scheduledLocalTime,
        scheduledTime: move.scheduledTime,
        updatedAt: this.#clock.now(),
      })
      .where(eq(todo.id, todoId.value))
      .returning({ id: todo.id });
    requireRecord(updated);
  }

  async deleteOccurrences(deletion: TodoOccurrenceDeletion): Promise<readonly number[]> {
    const deleted = await this.#db
      .delete(todo)
      .where(
        and(
          // seriesId만으로는 부분 유니크 인덱스를 못 타 Todo 전체를 훑는다. userId 인덱스로 좁힌다
          eq(todo.userId, deletion.userId.value),
          inArray(
            todo.seriesId,
            deletion.seriesIds.map((seriesId) => seriesId.value),
          ),
          deletion.fromDate == null
            ? undefined
            : gte(todo.occurrenceDate, Temporal.PlainDate.from(deletion.fromDate)),
          deletion.includeCompleted ? undefined : eq(todo.completed, false),
        ),
      )
      .returning({ id: todo.id });
    return deleted.map((row) => row.id);
  }

  async deleteMany(todoIds: readonly TodoId[]): Promise<void> {
    if (todoIds.length === 0) {
      return;
    }
    await this.#db.delete(todo).where(
      inArray(
        todo.id,
        todoIds.map((todoId) => todoId.value),
      ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
