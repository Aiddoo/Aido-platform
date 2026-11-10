import type { todo, todoCategory, todoItem } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import type { TodoItem } from "../../../shared/domain/todo-item.entity.js";
import { Todo } from "../../../shared/domain/todo.aggregate.js";
import type { RepeatRuleRow } from "../../../todo-series/infrastructure/persistence/repeat-rule-row.mapper.js";

type TodoCategoryRow = typeof todoCategory.$inferSelect;
type TodoRow = typeof todo.$inferSelect;

export type TodoItemRow = Pick<
  typeof todoItem.$inferSelect,
  "id" | "title" | "completed" | "sortOrder" | "createdAt" | "updatedAt"
>;

export type TodoAggregateRow = TodoRow & { items: TodoItemRow[] };

export type TodoWithCategory = TodoAggregateRow & {
  category: Pick<TodoCategoryRow, "id" | "name" | "color" | "sortOrder"> | null;
};

export type TodoWithSeries = TodoWithCategory & { series: RepeatRuleRow | null };

export function toTodo(row: TodoAggregateRow): Todo {
  return Todo.reconstitute({
    ...row,
    completedAt: row.completedAt == null ? null : instantFromDate(row.completedAt),
    items: row.items.map((item) => ({
      ...item,
      createdAt: instantFromDate(item.createdAt),
      updatedAt: instantFromDate(item.updatedAt),
    })),
    createdAt: instantFromDate(row.createdAt),
    updatedAt: instantFromDate(row.updatedAt),
  });
}

export function toTodoRow(entity: Todo): typeof todo.$inferInsert {
  const { items: _items, completedAt, createdAt, updatedAt, ...primitives } = entity.toPrimitives();
  return {
    ...primitives,
    completedAt: completedAt == null ? null : instantToDate(completedAt),
    createdAt: instantToDate(createdAt),
    updatedAt: instantToDate(updatedAt),
  };
}

export function toTodoItemRow(todoId: number, item: TodoItem): typeof todoItem.$inferInsert {
  const { createdAt, updatedAt, ...primitives } = item.toPrimitives();
  return {
    ...primitives,
    todoId,
    createdAt: instantToDate(createdAt),
    updatedAt: instantToDate(updatedAt),
  };
}
