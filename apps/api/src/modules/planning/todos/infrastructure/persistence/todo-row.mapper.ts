import type { todo, todoCategory, todoItem } from "#api/platform/database/schema/index";

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
  return Todo.reconstitute(row);
}

export function toTodoRow(entity: Todo): typeof todo.$inferInsert {
  const { items: _items, ...primitives } = entity.toPrimitives();
  return primitives;
}

export function toTodoItemRow(todoId: number, item: TodoItem): typeof todoItem.$inferInsert {
  return { ...item.toPrimitives(), todoId };
}
