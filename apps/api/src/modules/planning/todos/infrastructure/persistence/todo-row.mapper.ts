import type { todo, todoCategory } from "#api/platform/database/schema/index";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { TodoItem } from "../../../shared/domain/todo-item.entity.js";
import { TodoSchedule } from "../../../shared/domain/todo-schedule.vo.js";
import { Todo } from "../../../shared/domain/todo.aggregate.js";
import type { RepeatRuleRow } from "../../../todo-series/infrastructure/persistence/repeat-rule-row.mapper.js";

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

export function toTodo(row: TodoAggregateRow): Todo {
  return Todo.reconstitute({
    id: TodoId.create(row.id),
    userId: row.userId,
    title: row.title,
    categoryId: row.categoryId,
    sortOrder: row.sortOrder,
    completed: row.completed,
    completedAt: row.completedAt,
    schedule: TodoSchedule.reconstitute({
      startDate: row.startDate,
      endDate: row.endDate,
      scheduledLocalTime: row.scheduledLocalTime,
      scheduledTime: row.scheduledTime,
      isAllDay: row.isAllDay,
    }),
    visibility: row.visibility,
    seriesId: row.seriesId,
    occurrenceDate: row.occurrenceDate,
    items: row.items.map((item) => TodoItem.reconstitute(item)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
