import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import type { AddTodoFormInput } from '@src/features/todo/domains/add-todo-form.schema';
import { formatDate } from '@src/shared/utils/date';

export function toMemoConversionInput(data: AddTodoFormInput): ConvertMemoToTodosInput {
  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: data.title,
        categoryId: data.categoryId,
        startDate: formatDate(data.startDate),
        endDate: data.endDate ? formatDate(data.endDate) : undefined,
        scheduledTime: data.isAllDay ? undefined : (data.scheduledTime ?? undefined),
        isAllDay: data.isAllDay,
        visibility: data.visibility,
        isRecurring: data.isRecurring,
        recurrence:
          data.isRecurring && data.repeatEndDate
            ? { daysOfWeek: data.daysOfWeek, endDate: formatDate(data.repeatEndDate) }
            : undefined,
      },
    ],
  });
}
