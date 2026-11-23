import type { todo, todoCategory, todoItem } from "#api/platform/database/schema/index";

import type { RepeatRuleRow } from "../../../todo-series/infrastructure/persistence/repeat-rule-row.mapper.js";
import { Todo } from "../../domain/todo.aggregate.js";

type TodoCategoryRow = typeof todoCategory.$inferSelect;
type TodoRow = typeof todo.$inferSelect;

type TodoItemRow = Pick<
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

// 할 일 행의 Aggregate 칸만 담는다. 댓글·조회 수는 engagement 칸이라 넣지 않는다
export function toTodoRow(
  entity: Todo,
): Omit<typeof todo.$inferInsert, "commentCount" | "viewCount"> {
  const { items: _items, ...primitives } = entity.toPrimitives();
  return primitives;
}
