import { requireRecord } from "#api/platform/database/database-error.util";
import { toIsoString } from "#api/shared/domain/time/instant";

import { toRepeatRule } from "../../../todo-series/infrastructure/persistence/repeat-rule-row.mapper.js";
import type {
  FriendTodoReadModel,
  TodoReadModel,
} from "../../application/read-models/todo.read-model.js";
import type { TodoWithCategory, TodoWithSeries } from "./todo-row.mapper.js";

export function toFriendTodoReadModel(row: TodoWithCategory): FriendTodoReadModel {
  const category = requireRecord(row.category);
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
    // 옛 서버가 시간을 지운 행은 칸이 낡았을 수 있다. 칸이 빈 행은 앱이 순간에서 읽는다.
    scheduledLocalTime: row.scheduledTime == null ? null : row.scheduledLocalTime,
    isAllDay: row.isAllDay,
    visibility: row.visibility,
    seriesId: row.seriesId,
    category: {
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder,
    },
    items: row.items.map((item) => ({
      id: item.id,
      title: item.title,
      completed: item.completed,
      sortOrder: item.sortOrder,
      createdAt: toIsoString(item.createdAt),
      updatedAt: toIsoString(item.updatedAt),
    })),
    commentCount: row.commentCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toTodoReadModel(row: TodoWithSeries): TodoReadModel {
  return {
    ...toFriendTodoReadModel(row),
    repeat: row.series == null ? null : toRepeatRule(row.series).toSpec(),
    occurrenceDate: row.occurrenceDate?.toString() ?? null,
  };
}
