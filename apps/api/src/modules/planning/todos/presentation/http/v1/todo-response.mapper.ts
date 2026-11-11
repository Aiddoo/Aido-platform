import type { FriendTodo, Todo } from "@aido/api";
import { sumBy } from "es-toolkit";

import { toTodoRepeat } from "../../../../todo-series/presentation/http/v1/todo-series-response.mapper.js";
import type {
  FriendTodoReadModel,
  TodoReadModel,
} from "../../../application/read-models/todo.read-model.js";

export function toFriendTodoResponse(todo: FriendTodoReadModel): FriendTodo {
  const items = todo.items.map((item) => ({
    id: item.id,
    title: item.title,
    completed: item.completed,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
  return {
    id: todo.id,
    userId: todo.userId,
    title: todo.title,
    content: null, // deprecated: 하위 호환용
    sortOrder: todo.sortOrder,
    completed: todo.completed,
    completedAt: todo.completedAt,
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: todo.scheduledTime,
    scheduledLocalTime: todo.scheduledLocalTime,
    isAllDay: todo.isAllDay,
    visibility: todo.visibility,
    recurrenceGroupId: todo.seriesId,
    category: {
      id: todo.category.id,
      name: todo.category.name,
      color: todo.category.color,
      sortOrder: todo.category.sortOrder,
    },
    items,
    itemStats: {
      total: items.length,
      completed: sumBy(items, (item) => Number(item.completed)),
    },
    commentCount: todo.commentCount,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

export function toTodoResponse(todo: TodoReadModel): Todo {
  return {
    ...toFriendTodoResponse(todo),
    repeat: todo.repeat == null ? null : toTodoRepeat(todo.repeat),
    occurrenceDate: todo.occurrenceDate,
  };
}
