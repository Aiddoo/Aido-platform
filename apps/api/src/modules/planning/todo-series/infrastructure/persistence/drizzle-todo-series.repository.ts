import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoSeries } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  DueTodoSeriesQuery,
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../../application/ports/todo-series.repository.port.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { toTodoSeries, toTodoSeriesRow } from "./todo-series-row.mapper.js";

@Injectable()
export class DrizzleTodoSeriesRepository implements TodoSeriesRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByIdAndUserId(id: TodoSeriesId, userId: UserId): Promise<TodoSeries | null> {
    const row = await this.#db.query.todoSeries.findFirst({
      where: { id: id.value, userId: userId.value },
    });
    return row == null ? null : toTodoSeries(row);
  }

  async lockForUpdate(
    id: TodoSeriesId,
    options: { readonly skipLocked: boolean } = { skipLocked: false },
  ): Promise<TodoSeries | null> {
    const query = this.#db.select().from(todoSeries).where(eq(todoSeries.id, id.value));
    const [row] = await (options.skipLocked
      ? query.for("update", { skipLocked: true })
      : query.for("update"));
    return row == null ? null : toTodoSeries(row);
  }

  async insert(series: TodoSeries): Promise<void> {
    await this.#db
      .insert(todoSeries)
      .values({ ...toTodoSeriesRow(series), updatedAt: series.updatedAt });
  }

  async update(series: TodoSeries): Promise<void> {
    const { id, userId: _userId, createdAt: _createdAt, ...values } = toTodoSeriesRow(series);
    const updated = await this.#db
      .update(todoSeries)
      .set({ ...values, updatedAt: this.#clock.now() })
      .where(eq(todoSeries.id, id))
      .returning({ id: todoSeries.id });
    requireRecord(updated[0]);
  }

  async lockFamilyIds(
    userId: UserId,
    originSeriesId: TodoSeriesId,
  ): Promise<readonly TodoSeriesId[]> {
    const rows = await this.#db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, userId.value),
          eq(todoSeries.originSeriesId, originSeriesId.value),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .for("update");
    return rows.map((row) => TodoSeriesId.reconstitute(row.id));
  }

  async lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]> {
    const rows = await this.#db
      .select()
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, series.userId.value),
          eq(todoSeries.originSeriesId, series.originSeriesId.value),
          gte(todoSeries.startDate, Temporal.PlainDate.from(series.startDate)),
          ne(todoSeries.id, series.id.value),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .for("update");
    return rows.map(toTodoSeries);
  }

  async deleteMany(ids: readonly TodoSeriesId[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.#db.delete(todoSeries).where(
      inArray(
        todoSeries.id,
        ids.map((id) => id.value),
      ),
    );
  }

  countActiveByUserId(userId: UserId): Promise<number> {
    return this.#db.$count(
      todoSeries,
      and(eq(todoSeries.userId, userId.value), isNotNull(todoSeries.nextOccurrenceDate)),
    );
  }

  async existsActiveByUserId(userId: UserId): Promise<boolean> {
    const row = await this.#db.query.todoSeries.findFirst({
      columns: { id: true },
      where: { userId: userId.value, nextOccurrenceDate: { isNotNull: true } },
    });
    return row != null;
  }

  async updateTimezoneByUserId(userId: UserId, timezone: string): Promise<number> {
    const updated = await this.#db
      .update(todoSeries)
      .set({ timezone, updatedAt: this.#clock.now() })
      .where(and(eq(todoSeries.userId, userId.value), ne(todoSeries.timezone, timezone)))
      .returning({ id: todoSeries.id });
    return updated.length;
  }

  findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]> {
    return this.#db
      .select({ id: todoSeries.id, userId: todoSeries.userId })
      .from(todoSeries)
      .where(
        and(
          isNotNull(todoSeries.nextOccurrenceDate),
          lte(todoSeries.nextOccurrenceDate, Temporal.PlainDate.from(query.through)),
          query.afterId == null ? undefined : gt(todoSeries.id, query.afterId.value),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .limit(query.limit);
  }

  async findIdsBehind(userId: UserId, through: string): Promise<readonly string[]> {
    const rows = await this.#db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, userId.value),
          lte(todoSeries.nextOccurrenceDate, Temporal.PlainDate.from(through)),
        ),
      );
    return rows.map((row) => row.id);
  }
}
