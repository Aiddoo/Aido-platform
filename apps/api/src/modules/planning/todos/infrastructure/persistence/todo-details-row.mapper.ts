import { requireRecord } from "#api/platform/database/database-error.util";
import type { todo, todoCategory, todoItem } from "#api/platform/database/schema/index";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { FriendTodoReadModel } from "../../application/read-models/todo.read-model.js";

export type TodoDetailsRow = typeof todo.$inferSelect & {
  category: typeof todoCategory.$inferSelect | null;
  items: (typeof todoItem.$inferSelect)[];
};

export function toFriendTodoReadModel(row: TodoDetailsRow): FriendTodoReadModel {
  const items = row.items.map((item) => ({
    id: item.id,
    title: item.title,
    completed: item.completed,
    sortOrder: item.sortOrder,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
  }));

  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    sortOrder: row.sortOrder,
    completed: row.completed,
    completedAt: row.completedAt == null ? null : toIsoString(row.completedAt),
    startDate: row.startDate.toString(),
    endDate: row.endDate?.toString() ?? null,
    scheduledTime: row.scheduledTime == null ? null : toIsoString(row.scheduledTime),
    scheduledLocalTime: row.scheduledTime == null ? null : row.scheduledLocalTime,
    isAllDay: row.isAllDay,
    visibility: row.visibility,
    seriesId: row.seriesId,
    category: {
      id: requireRecord(row.category).id,
      name: requireRecord(row.category).name,
      color: requireRecord(row.category).color,
      sortOrder: requireRecord(row.category).sortOrder,
    },
    items,
    commentCount: row.commentCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
