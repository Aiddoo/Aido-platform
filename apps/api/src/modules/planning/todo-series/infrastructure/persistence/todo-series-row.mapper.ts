import { match } from "ts-pattern";

import type { todoSeries } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { dateKeyOf, utcMidnightOf } from "../../../shared/domain/todo-calendar.domain-service.js";
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
    startDate: dateKeyOf(row.startDate),
    checklistTemplate: row.checklistTemplate,
    nextOccurrenceDate: row.nextOccurrenceDate == null ? null : dateKeyOf(row.nextOccurrenceDate),
    generatedCount: row.generatedCount,
    createdAt: instantFromDate(row.createdAt),
    updatedAt: instantFromDate(row.updatedAt),
  });
}

// updatedAt은 칸의 $onUpdate가 쓴다
export function toTodoSeriesRow(series: TodoSeries): typeof todoSeries.$inferInsert {
  const primitives = series.toPrimitives();
  const { frequency, interval, weekdays, monthDay, end } = primitives.rule;
  const { repeatUntil, repeatCount } = match(end)
    .with({ type: "NEVER" }, () => ({ repeatUntil: null, repeatCount: null }))
    .with({ type: "UNTIL" }, ({ date }) => ({
      repeatUntil: utcMidnightOf(date),
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
    startDate: utcMidnightOf(primitives.startDate),
    repeatUntil,
    repeatCount,
    checklistTemplate: [...primitives.checklistTemplate],
    nextOccurrenceDate:
      primitives.nextOccurrenceDate == null ? null : utcMidnightOf(primitives.nextOccurrenceDate),
    generatedCount: primitives.generatedCount,
    createdAt: instantToDate(primitives.createdAt),
  };
}
