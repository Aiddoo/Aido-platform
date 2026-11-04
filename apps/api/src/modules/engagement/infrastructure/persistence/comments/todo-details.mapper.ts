import type { FriendTodo } from "@aido/api";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { todo, todoCategory, todoItem } from "#api/platform/database/schema/index";
import {
  toDateString,
  toDateStringOrNull,
  toISOString,
  toISOStringOrNull,
} from "#api/shared/domain/date/utils/format";

export type TodoDetailsRow = typeof todo.$inferSelect & {
  category: typeof todoCategory.$inferSelect | null;
  items: (typeof todoItem.$inferSelect)[];
};

export function toTodoResponse(row: TodoDetailsRow): FriendTodo {
  const items = row.items.map((item) => ({
    id: item.id,
    title: item.title,
    completed: item.completed,
    sortOrder: item.sortOrder,
    createdAt: toISOString(item.createdAt),
    updatedAt: toISOString(item.updatedAt),
  }));

  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: null,
    sortOrder: row.sortOrder,
    completed: row.completed,
    completedAt: toISOStringOrNull(row.completedAt),
    startDate: toDateString(row.startDate),
    endDate: toDateStringOrNull(row.endDate),
    scheduledTime: toISOStringOrNull(row.scheduledTime),
    isAllDay: row.isAllDay,
    visibility: row.visibility,
    recurrenceGroupId: row.seriesId,
    category: {
      id: requireRecord(row.category).id,
      name: requireRecord(row.category).name,
      color: requireRecord(row.category).color,
      sortOrder: requireRecord(row.category).sortOrder,
    },
    items,
    itemStats: {
      total: items.length,
      completed: items.filter((item) => item.completed).length,
    },
    commentCount: row.commentCount,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}
