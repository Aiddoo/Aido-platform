import { DAYS_OF_WEEK, type DayOfWeek, type TodoRepeatInterval } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { match } from "ts-pattern";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoSeries, user } from "#api/platform/database/schema/index";
import { toDateString, toDateStringOrNull } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import type {
  DueTodoSeries,
  DueTodoSeriesQuery,
  TodoSeriesRepositoryPort,
} from "../../../application/ports/series/todo-series.repository.port.js";
import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { RepeatRule, type RepeatEnd } from "../../../domain/value-objects/series/repeat-rule.vo.js";

type TodoSeriesRow = typeof todoSeries.$inferSelect;

function toRepeatEnd(row: TodoSeriesRow): RepeatEnd {
  if (row.repeatUntil != null) {
    return { type: "UNTIL", date: toDateString(row.repeatUntil) };
  }
  if (row.repeatCount != null) {
    return { type: "COUNT", count: row.repeatCount };
  }
  return { type: "NEVER" };
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return DAYS_OF_WEEK.some((weekday) => weekday === value);
}

function toInterval(value: number): TodoRepeatInterval {
  return value === 2 ? 2 : 1;
}

function toDomain(row: TodoSeriesRow): TodoSeries {
  return TodoSeries.reconstitute({
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    title: row.title,
    visibility: row.visibility,
    scheduledLocalTime: row.scheduledLocalTime,
    timezone: row.timezone,
    rule: RepeatRule.reconstitute({
      frequency: row.repeatFrequency,
      interval: toInterval(row.repeatInterval),
      weekdays: row.repeatWeekdays?.filter(isDayOfWeek) ?? null,
      monthDay: row.repeatMonthDay,
      end: toRepeatEnd(row),
    }),
    startDate: toDateString(row.startDate),
    checklistTemplate: row.checklistTemplate,
    sortOrder: row.sortOrder,
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
    sortOrder: snapshot.sortOrder,
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

  async delete(id: string): Promise<void> {
    await this.db.delete(todoSeries).where(eq(todoSeries.id, id));
  }

  countActiveByUserId(userId: string): Promise<number> {
    return this.db.$count(
      todoSeries,
      and(eq(todoSeries.userId, userId), isNotNull(todoSeries.nextOccurrenceDate)),
    );
  }

  async findDueBatch(query: DueTodoSeriesQuery): Promise<readonly DueTodoSeries[]> {
    // 정지·탈퇴 대기 계정은 건너뛴다. 커서가 그대로라 복구되면 빠진 회차를 이어서 만든다.
    return this.db
      .select({ id: todoSeries.id, userId: todoSeries.userId })
      .from(todoSeries)
      .innerJoin(user, eq(user.id, todoSeries.userId))
      .where(
        and(
          isNotNull(todoSeries.nextOccurrenceDate),
          isNull(user.deletedAt),
          ne(user.status, "SUSPENDED"),
          lte(todoSeries.nextOccurrenceDate, parseDateOnly(query.through)),
          query.afterId == null ? undefined : gt(todoSeries.id, query.afterId),
        ),
      )
      .orderBy(asc(todoSeries.id))
      .limit(query.limit);
  }
}
