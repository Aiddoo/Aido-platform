import { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";

import type { ConvertMemoToTodoCommand } from "../../../application/use-cases/convert-memo-to-todo.use-case.js";
import type { ConvertMemoToTodosCommand } from "../../../application/use-cases/convert-memo-to-todos.use-case.js";
import type { ConvertMemoToTodoDto, ConvertMemoToTodosDto } from "./memo.dto.js";

export function toConvertedTodoDraft(dto: ConvertMemoToTodoDto): ConvertMemoToTodoCommand["todo"] {
  return {
    categoryId: TodoCategoryId.reconstitute(dto.categoryId),
    startDate: Temporal.PlainDate.from(dto.startDate),
    endDate: dto.endDate == null ? undefined : Temporal.PlainDate.from(dto.endDate),
    scheduledTime: dto.scheduledTime,
    isAllDay: dto.isAllDay,
    visibility: dto.visibility,
    items: dto.items,
  };
}

export function toConvertedTodoDrafts(
  dto: ConvertMemoToTodosDto,
): ConvertMemoToTodosCommand["todos"] {
  return dto.todos.map((todo) => ({
    title: todo.title,
    categoryId: TodoCategoryId.reconstitute(todo.categoryId),
    startDate: Temporal.PlainDate.from(todo.startDate),
    endDate: todo.endDate == null ? undefined : Temporal.PlainDate.from(todo.endDate),
    scheduledTime: todo.scheduledTime,
    isAllDay: todo.isAllDay,
    visibility: todo.visibility,
    // 출시 앱(1.14.x까지)은 isRecurring + recurrence(요일 + 종료일)만 보낸다.
    repeat:
      todo.repeat ??
      (todo.isRecurring && todo.recurrence != null
        ? {
            frequency: "WEEKLY",
            interval: 1,
            weekdays: todo.recurrence.daysOfWeek,
            end: { type: "UNTIL", date: todo.recurrence.endDate },
          }
        : undefined),
    usesLegacySeriesLimit: todo.repeat == null,
    items: todo.items,
  }));
}
