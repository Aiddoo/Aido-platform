import type { Todo, TodoCategory } from "#api/platform/database/database.types";

export type TodoAggregateRow = Todo & { items: TodoItemData[] };

export interface TodoItemData {
  id: number;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TodoWithCategory = TodoAggregateRow & {
  category: Pick<TodoCategory, "id" | "name" | "color" | "sortOrder"> | null;
};
