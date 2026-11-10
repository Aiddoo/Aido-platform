import type { todoCategory } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import type { TodoCategoryWithCountReadModel } from "../../application/read-models/todo-category-with-count.read-model.js";
import { TodoCategory } from "../../domain/todo-category.aggregate.js";

export type TodoCategoryRow = typeof todoCategory.$inferSelect;
export type TodoCategoryRowWithCount = TodoCategoryRow & { todos: number };

export function toTodoCategory(row: TodoCategoryRow): TodoCategory {
  return TodoCategory.reconstitute({
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: instantFromDate(row.createdAt),
    updatedAt: instantFromDate(row.updatedAt),
  });
}

export function toTodoCategoryRow(category: TodoCategory): typeof todoCategory.$inferInsert {
  const { createdAt, updatedAt, ...primitives } = category.toPrimitives();
  return {
    ...primitives,
    createdAt: instantToDate(createdAt),
    updatedAt: instantToDate(updatedAt),
  };
}

export function toTodoCategoryWithCountReadModel(
  row: TodoCategoryRowWithCount,
): TodoCategoryWithCountReadModel {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    todoCount: row.todos,
  };
}
