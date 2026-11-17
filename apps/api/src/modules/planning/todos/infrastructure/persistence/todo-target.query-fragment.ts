import { and, eq, inArray } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { todo } from "#api/platform/database/schema/index";

// 다른 Context가 할 일 id 묶음으로 알림·리마인더 대상을 한 SQL로 읽는 하위 질의다

export function todoOwnerDates(todoIds: readonly number[]) {
  return new QueryBuilder()
    .select({ id: todo.id, userId: todo.userId, startDate: todo.startDate })
    .from(todo)
    .where(inArray(todo.id, [...todoIds]))
    .as("todo_owner_dates");
}

// 할 일 id 칸 옆에 그 할 일의 주인을 붙이는 하위 질의다. 한 SQL에 여러 번 붙일 때는 별칭을 다르게 준다
export function todoOwners(alias: string) {
  return new QueryBuilder().select({ todoId: todo.id, ownerId: todo.userId }).from(todo).as(alias);
}

// 리마인더를 울릴 수 있는(끝내지 않은) 할 일이다
export function openReminderTodos(todoIds: readonly number[]) {
  return new QueryBuilder()
    .select({
      id: todo.id,
      title: todo.title,
      seriesId: todo.seriesId,
      startDate: todo.startDate,
      scheduledLocalTime: todo.scheduledLocalTime,
      scheduledTime: todo.scheduledTime,
    })
    .from(todo)
    .where(and(inArray(todo.id, [...todoIds]), eq(todo.completed, false)))
    .as("open_reminder_todos");
}
