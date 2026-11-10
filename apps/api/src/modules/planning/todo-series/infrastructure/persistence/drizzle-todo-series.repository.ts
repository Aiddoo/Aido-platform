import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoSeries } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  DueTodoSeriesQuery,
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../../application/ports/todo-series.repository.port.js";
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

  async findByIdAndUserId(id: string, userId: string): Promise<TodoSeries | null> {
    const row = await this.#db.query.todoSeries.findFirst({ where: { id, userId } });
    return row == null ? null : toTodoSeries(row);
  }

  async lockForUpdate(
    id: string,
    options: { readonly skipLocked: boolean } = { skipLocked: false },
  ): Promise<TodoSeries | null> {
    const query = this.#db.select().from(todoSeries).where(eq(todoSeries.id, id));
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

  async lockFamilyIds(userId: string, originSeriesId: string): Promise<readonly string[]> {
    const rows = await this.#db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(and(eq(todoSeries.userId, userId), eq(todoSeries.originSeriesId, originSeriesId)))
      .orderBy(asc(todoSeries.id))
      .for("update");
    return rows.map((row) => row.id);
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

  async deleteMany(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.#db.delete(todoSeries).where(inArray(todoSeries.id, [...ids]));
  }

  countActiveByUserId(userId: string): Promise<number> {
    return this.#db.$count(
      todoSeries,
      and(eq(todoSeries.userId, userId), isNotNull(todoSeries.nextOccurrenceDate)),
    );
  }

  async updateTimezoneByUserId(userId: string, timezone: string): Promise<number> {
    const updated = await this.#db
      .update(todoSeries)
      .set({ timezone, updatedAt: this.#clock.now() })
      .where(and(eq(todoSeries.userId, userId), ne(todoSeries.timezone, timezone)))
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
          query.afterId == null ? undefined : gt(todoSeries.id, query.afterId),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .limit(query.limit);
  }

  async findIdsBehind(userId: string, through: string): Promise<readonly string[]> {
    const rows = await this.#db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, userId),
          lte(todoSeries.nextOccurrenceDate, Temporal.PlainDate.from(through)),
        ),
      );
    return rows.map((row) => row.id);
  }
}
