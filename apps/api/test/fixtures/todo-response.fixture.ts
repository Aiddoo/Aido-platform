import type { Todo as TodoResponse } from "@aido/api";

import type { TodoReadModel } from "#api/modules/planning/todos/planning-todos.public";
import { toIsoString } from "#api/shared/domain/time/instant";
import type { TodoBuilder } from "#test/builders/index";

export type PlanningTodoRecord = ReturnType<TodoBuilder["build"]>;

export function createTodoResponseFixture(record: PlanningTodoRecord): TodoResponse {
  if (record.category === null) {
    throw new Error("Todo fixture category is missing");
  }
  const items = record.items.map((item) => ({
    ...item,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  }));
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    content: null,
    sortOrder: record.sortOrder,
    completed: record.completed,
    completedAt: record.completedAt == null ? null : toIsoString(record.completedAt),
    startDate: record.startDate.toString(),
    endDate: record.endDate?.toString() ?? null,
    scheduledTime: record.scheduledTime == null ? null : toIsoString(record.scheduledTime),
    scheduledLocalTime: record.scheduledTime == null ? null : record.scheduledLocalTime,
    isAllDay: record.isAllDay,
    visibility: record.visibility,
    recurrenceGroupId: record.seriesId,
    category: { ...record.category },
    items,
    itemStats: { total: items.length, completed: items.filter((item) => item.completed).length },
    commentCount: record.commentCount,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

/** 저장 행 모양 기록을 planning Read Model로 바꾼다. 반복 규칙은 담지 않는다. */
export function createTodoReadModelFromRecord(record: PlanningTodoRecord): TodoReadModel {
  const {
    content: _content,
    itemStats: _itemStats,
    recurrenceGroupId,
    ...response
  } = createTodoResponseFixture(record);
  return {
    ...response,
    scheduledLocalTime: response.scheduledLocalTime ?? null,
    seriesId: recurrenceGroupId,
    repeat: null,
    occurrenceDate: record.occurrenceDate?.toString() ?? null,
  };
}
