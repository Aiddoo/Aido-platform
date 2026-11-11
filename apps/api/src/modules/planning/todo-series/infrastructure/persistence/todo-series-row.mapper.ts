import { match } from "ts-pattern";

import type { todoSeries } from "#api/platform/database/schema/index";

import { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { toRepeatRule } from "./repeat-rule-row.mapper.js";

type TodoSeriesRow = typeof todoSeries.$inferSelect;

export function toTodoSeries(row: TodoSeriesRow): TodoSeries {
  return TodoSeries.reconstitute({
    id: row.id,
    originSeriesId: row.originSeriesId,
    userId: row.userId,
    categoryId: row.categoryId,
    title: row.title,
    visibility: row.visibility,
    scheduledLocalTime: row.scheduledLocalTime,
    timezone: row.timezone,
    rule: toRepeatRule(row).toPrimitives(),
    startDate: row.startDate.toString(),
    checklistTemplate: row.checklistTemplate,
    nextOccurrenceDate: row.nextOccurrenceDate?.toString() ?? null,
    generatedCount: row.generatedCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// 규칙의 updatedAt은 도메인이 바꾸지 않아 저장소가 쓸 때마다 ClockPort 값으로 채운다
export function toTodoSeriesRow(
  series: TodoSeries,
): Omit<typeof todoSeries.$inferInsert, "updatedAt"> {
  const primitives = series.toPrimitives();
  const { frequency, interval, weekdays, monthDay, end } = primitives.rule;
  const { repeatUntil, repeatCount } = match(end)
    .with({ type: "NEVER" }, () => ({ repeatUntil: null, repeatCount: null }))
    .with({ type: "UNTIL" }, ({ date }) => ({
      repeatUntil: Temporal.PlainDate.from(date),
      repeatCount: null,
    }))
    .with({ type: "COUNT" }, ({ count }) => ({ repeatUntil: null, repeatCount: count }))
    .exhaustive();
  return {
    id: primitives.id,
    originSeriesId: primitives.originSeriesId,
    userId: primitives.userId,
    categoryId: primitives.categoryId,
    title: primitives.title,
    visibility: primitives.visibility,
    scheduledLocalTime: primitives.scheduledLocalTime,
    timezone: primitives.timezone,
    repeatFrequency: frequency,
    repeatInterval: interval,
    repeatWeekdays: weekdays == null ? null : [...weekdays],
    repeatMonthDay: monthDay,
    startDate: Temporal.PlainDate.from(primitives.startDate),
    repeatUntil,
    repeatCount,
    checklistTemplate: [...primitives.checklistTemplate],
    nextOccurrenceDate:
      primitives.nextOccurrenceDate == null
        ? null
        : Temporal.PlainDate.from(primitives.nextOccurrenceDate),
    generatedCount: primitives.generatedCount,
    createdAt: primitives.createdAt,
  };
}
