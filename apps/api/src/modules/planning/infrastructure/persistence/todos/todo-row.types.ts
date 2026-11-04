import type { todo, todoCategory } from "#api/platform/database/schema/index";

import type { RepeatRuleRow } from "../series/repeat-rule-row.mapper.js";

type TodoCategoryRow = typeof todoCategory.$inferSelect;

export type TodoAggregateRow = typeof todo.$inferSelect & { items: TodoItemData[] };

export interface TodoItemData {
  id: number;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TodoWithCategory = TodoAggregateRow & {
  category: Pick<TodoCategoryRow, "id" | "name" | "color" | "sortOrder"> | null;
};

export type TodoWithSeries = TodoWithCategory & { series: RepeatRuleRow | null };
