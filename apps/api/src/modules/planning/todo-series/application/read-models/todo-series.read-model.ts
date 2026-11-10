import type { TodoRepeat, TodoSeriesResponse } from "@aido/api";
import { match } from "ts-pattern";

import type { RepeatRule } from "../../domain/repeat-rule.vo.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";

export function toTodoRepeat(rule: RepeatRule): TodoRepeat {
  return match(rule.toSpec())
    .returnType<TodoRepeat>()
    .with({ frequency: "DAILY" }, (spec) => spec)
    .with({ frequency: "MONTHLY" }, (spec) => spec)
    .with({ frequency: "WEEKLY" }, (spec) => ({ ...spec, weekdays: [...spec.weekdays] }))
    .exhaustive();
}

export function toTodoSeriesResponse(series: TodoSeries): TodoSeriesResponse {
  const snapshot = series.toPersistence();
  return {
    id: snapshot.id,
    title: snapshot.title,
    categoryId: snapshot.categoryId,
    visibility: snapshot.visibility,
    scheduledTime: snapshot.scheduledLocalTime,
    timezone: snapshot.timezone,
    repeat: toTodoRepeat(snapshot.rule),
    startDate: snapshot.startDate,
    nextOccurrenceDate: snapshot.nextOccurrenceDate,
    isActive: series.isActive(),
    checklist: series.getChecklistTemplate(),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
