import type { todoCategory } from "#api/platform/database/schema/index";
import { toIsoString } from "#api/shared/domain/time/instant";

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toTodoCategoryRow(category: TodoCategory): typeof todoCategory.$inferInsert {
  return category.toPrimitives();
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
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    todoCount: row.todos,
  };
}
