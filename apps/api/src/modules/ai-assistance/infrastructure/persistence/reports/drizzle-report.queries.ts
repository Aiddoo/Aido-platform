import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";

import type { Database } from "#api/platform/database/database.client";
import { todo, todoCategory } from "#api/platform/database/schema/index";

export interface ReportPeriod {
  userId: string;
  start: Date;
  end: Date;
}

function inPeriod({ userId, start, end }: ReportPeriod) {
  return and(eq(todo.userId, userId), gte(todo.startDate, start), lt(todo.startDate, end));
}

export function selectDailyCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ startDate: todo.startDate, completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.startDate, todo.completed);
}

export function selectPreviousCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.completed);
}

export function selectCategoryCounts(db: Database, period: ReportPeriod) {
  return db
    .select({ categoryId: todo.categoryId, completed: todo.completed, count: count() })
    .from(todo)
    .where(inPeriod(period))
    .groupBy(todo.categoryId, todo.completed);
}

export function selectCategories(db: Database, userId: string) {
  return db
    .select({ id: todoCategory.id, name: todoCategory.name, color: todoCategory.color })
    .from(todoCategory)
    .where(eq(todoCategory.userId, userId));
}

export function selectCompletedTodos(db: Database, period: ReportPeriod) {
  return db
    .select({ startDate: todo.startDate, completedAt: todo.completedAt })
    .from(todo)
    .where(and(inPeriod(period), eq(todo.completed, true), isNotNull(todo.completedAt)));
}
