import type { TodoRepeat, TodoSeriesResponse } from "@aido/api";
import { match } from "ts-pattern";

import { toIsoString } from "#api/shared/domain/time/instant";

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
  return {
    id: series.id.value,
    title: series.title.value,
    categoryId: series.categoryId,
    visibility: series.visibility,
    scheduledTime: series.scheduledLocalTime,
    timezone: series.timezone,
    repeat: toTodoRepeat(series.rule),
    startDate: series.startDate,
    nextOccurrenceDate: series.nextOccurrenceDate,
    isActive: series.isActive,
    checklist: series.checklistTemplate,
    createdAt: toIsoString(series.createdAt),
    updatedAt: toIsoString(series.updatedAt),
  };
}
