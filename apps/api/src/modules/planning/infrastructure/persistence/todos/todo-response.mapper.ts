import type { Todo } from "@aido/api";
import { sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/prisma-error.util";
import {
  toDateString,
  toDateStringOrNull,
  toISOString,
  toISOStringOrNull,
} from "#api/shared/domain/date/utils/format";

import type { TodoWithCategory } from "./todo-row.types.js";

export abstract class TodoMapper {
  static toResponse(entity: TodoWithCategory): Todo {
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
      isAllDay: entity.isAllDay,
      visibility: entity.visibility,
      recurrenceGroupId: entity.recurrenceGroupId,
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
  }

  static toManyResponse(entities: TodoWithCategory[]): Todo[] {
    return entities.map((entity) => TodoMapper.toResponse(entity));
  }
}
