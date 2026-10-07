import type { Todo as TodoResponse } from "@aido/api";

import type { TodoBuilder } from "#test/builders/index";

export type PlanningTodoRecord = ReturnType<TodoBuilder["build"]>;

export function createTodoResponseFixture(record: PlanningTodoRecord): TodoResponse {
  if (record.category === null) throw new Error("Todo fixture category is missing");
  const items = record.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    content: null,
    sortOrder: record.sortOrder,
    completed: record.completed,
    completedAt: record.completedAt?.toISOString() ?? null,
    startDate: record.startDate.toISOString().slice(0, 10),
    endDate: record.endDate?.toISOString().slice(0, 10) ?? null,
    scheduledTime: record.scheduledTime?.toISOString() ?? null,
    isAllDay: record.isAllDay,
    visibility: record.visibility,
    recurrenceGroupId: record.recurrenceGroupId,
    category: { ...record.category },
    items,
    itemStats: { total: items.length, completed: items.filter((item) => item.completed).length },
    commentCount: record.commentCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
