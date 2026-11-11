import type { FriendTodo, Todo } from "@aido/api";
import { sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import {
  toDateString,
  toDateStringOrNull,
  toISOString,
  toISOStringOrNull,
} from "#api/shared/domain/date/utils/format";

import { toTodoRepeat } from "../../../application/read-models/series/todo-series.read-model.js";
import { toRepeatRule } from "../series/repeat-rule-row.mapper.js";
import type { TodoWithCategory, TodoWithSeries } from "./todo-row.types.js";

export const TodoMapper = {
  toFriendResponse(entity: TodoWithCategory): FriendTodo {
    const category = requireRecord(entity.category);
    const items = entity.items.map((item) => ({
      id: item.id,
      title: item.title,
      completed: item.completed,
      sortOrder: item.sortOrder,
      createdAt: toISOString(item.createdAt),
      updatedAt: toISOString(item.updatedAt),
    }));

    return {
      id: entity.id,
      userId: entity.userId,
      title: entity.title,
      content: null, // deprecated: 하위 호환용
      sortOrder: entity.sortOrder,
      completed: entity.completed,
      completedAt: toISOStringOrNull(entity.completedAt),
      startDate: toDateString(entity.startDate),
      endDate: toDateStringOrNull(entity.endDate),
      scheduledTime: toISOStringOrNull(entity.scheduledTime),
      // 옛 서버가 시간을 지운 행은 칸이 낡았을 수 있다. 칸이 빈 행은 앱이 순간에서 읽는다.
      scheduledLocalTime: entity.scheduledTime == null ? null : entity.scheduledLocalTime,
      isAllDay: entity.isAllDay,
      visibility: entity.visibility,
      recurrenceGroupId: entity.seriesId,
      category: {
        id: category.id,
        name: category.name,
        color: category.color,
        sortOrder: category.sortOrder,
      },
      items,
      itemStats: {
        total: items.length,
        completed: sumBy(items, (item) => Number(item.completed)),
      },
      commentCount: entity.commentCount,
      createdAt: toISOString(entity.createdAt),
      updatedAt: toISOString(entity.updatedAt),
    };
  },

  toManyFriendResponse(entities: TodoWithCategory[]): FriendTodo[] {
    return entities.map((entity) => TodoMapper.toFriendResponse(entity));
  },

  toResponse(entity: TodoWithSeries): Todo {
    return {
      ...TodoMapper.toFriendResponse(entity),
      repeat: entity.series == null ? null : toTodoRepeat(toRepeatRule(entity.series)),
      occurrenceDate: toDateStringOrNull(entity.occurrenceDate),
    };
  },

  toManyResponse(entities: TodoWithSeries[]): Todo[] {
    return entities.map((entity) => TodoMapper.toResponse(entity));
  },
};
