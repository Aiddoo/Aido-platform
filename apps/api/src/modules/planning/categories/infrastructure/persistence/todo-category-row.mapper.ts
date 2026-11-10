import type { todoCategory } from "#api/platform/database/schema/index";

import type { TodoCategoryWithCountView } from "../../application/ports/todo-category.repository.port.js";
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

export function toTodoCategoryWithCountView(
  row: TodoCategoryRowWithCount,
): TodoCategoryWithCountView {
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
