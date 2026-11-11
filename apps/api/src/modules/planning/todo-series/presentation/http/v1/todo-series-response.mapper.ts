import type { TodoRepeat, TodoSeriesResponse } from "@aido/api";
import { match } from "ts-pattern";

import type { TodoSeriesReadModel } from "../../../application/read-models/todo-series.read-model.js";

export function toTodoRepeat(spec: TodoSeriesReadModel["repeat"]): TodoRepeat {
  return match(spec)
    .returnType<TodoRepeat>()
    .with({ frequency: "DAILY" }, (daily) => daily)
    .with({ frequency: "MONTHLY" }, (monthly) => monthly)
    .with({ frequency: "WEEKLY" }, (weekly) => ({ ...weekly, weekdays: [...weekly.weekdays] }))
    .exhaustive();
}

export function toTodoSeriesResponse(series: TodoSeriesReadModel): TodoSeriesResponse {
  return {
    id: series.id,
    title: series.title,
    categoryId: series.categoryId,
    visibility: series.visibility,
    scheduledTime: series.scheduledLocalTime,
    timezone: series.timezone,
    repeat: toTodoRepeat(series.repeat),
    startDate: series.startDate,
    nextOccurrenceDate: series.nextOccurrenceDate,
    isActive: series.isActive,
    checklist: series.checklist.map((item) => ({ title: item.title })),
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
  };
}
