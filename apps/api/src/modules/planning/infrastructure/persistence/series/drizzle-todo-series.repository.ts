import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { match } from "ts-pattern";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoSeries } from "#api/platform/database/schema/index";
import { toDateString, toDateStringOrNull } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import type {
  DueTodoSeriesQuery,
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../../../application/ports/series/todo-series.repository.port.js";
import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { toRepeatRule } from "./repeat-rule-row.mapper.js";

type TodoSeriesRow = typeof todoSeries.$inferSelect;

function toDomain(row: TodoSeriesRow): TodoSeries {
  return TodoSeries.reconstitute({
    id: row.id,
    originSeriesId: row.originSeriesId,
    userId: row.userId,
    categoryId: row.categoryId,
    title: row.title,
    visibility: row.visibility,
    scheduledLocalTime: row.scheduledLocalTime,
    timezone: row.timezone,
    rule: toRepeatRule(row),
    startDate: toDateString(row.startDate),
    checklistTemplate: row.checklistTemplate,
    nextOccurrenceDate: toDateStringOrNull(row.nextOccurrenceDate),
    generatedCount: row.generatedCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toRow(series: TodoSeries): typeof todoSeries.$inferInsert {
  const snapshot = series.toPersistence();
  const { frequency, interval, weekdays, monthDay, end } = snapshot.rule.getValue();
  const { repeatUntil, repeatCount } = match(end)
    .with({ type: "NEVER" }, () => ({ repeatUntil: null, repeatCount: null }))
    .with({ type: "UNTIL" }, ({ date }) => ({
      repeatUntil: parseDateOnly(date),
      repeatCount: null,
    }))
    .with({ type: "COUNT" }, ({ count }) => ({ repeatUntil: null, repeatCount: count }))
    .exhaustive();
  return {
    id: snapshot.id,
    originSeriesId: snapshot.originSeriesId,
    userId: snapshot.userId,
    categoryId: snapshot.categoryId,
    title: snapshot.title,
    visibility: snapshot.visibility,
    scheduledLocalTime: snapshot.scheduledLocalTime,
    timezone: snapshot.timezone,
    repeatFrequency: frequency,
    repeatInterval: interval,
    repeatWeekdays: weekdays == null ? null : [...weekdays],
    repeatMonthDay: monthDay,
    startDate: parseDateOnly(snapshot.startDate),
    repeatUntil,
    repeatCount,
    checklistTemplate: [...snapshot.checklistTemplate],
    nextOccurrenceDate:
      snapshot.nextOccurrenceDate == null ? null : parseDateOnly(snapshot.nextOccurrenceDate),
    generatedCount: snapshot.generatedCount,
    createdAt: snapshot.createdAt,
  };
}

@Injectable()
export class DrizzleTodoSeriesRepository implements TodoSeriesRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<TodoSeries | null> {
    const row = await this.db.query.todoSeries.findFirst({ where: { id, userId } });
    return row == null ? null : toDomain(row);
  }

  async lockForUpdate(
    id: string,
    options: { readonly skipLocked: boolean } = { skipLocked: false },
  ): Promise<TodoSeries | null> {
    const query = this.db.select().from(todoSeries).where(eq(todoSeries.id, id));
    const [row] = await (options.skipLocked
      ? query.for("update", { skipLocked: true })
      : query.for("update"));
    return row == null ? null : toDomain(row);
  }

  async insert(series: TodoSeries): Promise<void> {
    await this.db.insert(todoSeries).values(toRow(series));
  }

  async update(series: TodoSeries): Promise<void> {
    const { id, userId: _userId, createdAt: _createdAt, ...values } = toRow(series);
    const updated = await this.db
      .update(todoSeries)
      .set(values)
      .where(eq(todoSeries.id, id))
      .returning({ id: todoSeries.id });
    requireRecord(updated[0]);
  }

  async lockFamilyIds(userId: string, originSeriesId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(and(eq(todoSeries.userId, userId), eq(todoSeries.originSeriesId, originSeriesId)))
      .orderBy(asc(todoSeries.id))
      .for("update");
    return rows.map((row) => row.id);
  }

  async lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]> {
    const rows = await this.db
      .select()
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, series.getUserId()),
          eq(todoSeries.originSeriesId, series.getOriginSeriesId()),
          gte(todoSeries.startDate, parseDateOnly(series.getStartDate())),
          ne(todoSeries.id, series.getId()),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .for("update");
    return rows.map(toDomain);
  }

  async deleteMany(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.db.delete(todoSeries).where(inArray(todoSeries.id, [...ids]));
  }

  countActiveByUserId(userId: string): Promise<number> {
    return this.db.$count(
      todoSeries,
      and(eq(todoSeries.userId, userId), isNotNull(todoSeries.nextOccurrenceDate)),
    );
  }

  findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]> {
    return this.db
      .select({ id: todoSeries.id, userId: todoSeries.userId })
      .from(todoSeries)
      .where(
        and(
          isNotNull(todoSeries.nextOccurrenceDate),
          lte(todoSeries.nextOccurrenceDate, parseDateOnly(query.through)),
          query.afterId == null ? undefined : gt(todoSeries.id, query.afterId),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .limit(query.limit);
  }

  async findIdsBehind(userId: string, through: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ id: todoSeries.id })
      .from(todoSeries)
      .where(
        and(
          eq(todoSeries.userId, userId),
          lte(todoSeries.nextOccurrenceDate, parseDateOnly(through)),
        ),
      );
    return rows.map((row) => row.id);
  }
}
