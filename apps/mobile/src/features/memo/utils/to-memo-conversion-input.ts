import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import type { AddTodoFormInput } from '@src/features/todo/domains/add-todo-form.schema';
import { formatDate } from '@src/shared/utils/date';

export function toMemoConversionInput(formValues: AddTodoFormInput): ConvertMemoToTodosInput {
  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: formValues.title,
        categoryId: formValues.categoryId,
        startDate: formatDate(formValues.startDate),
        endDate: formValues.endDate ? formatDate(formValues.endDate) : undefined,
        scheduledTime: formValues.isAllDay ? undefined : (formValues.scheduledTime ?? undefined),
        isAllDay: formValues.isAllDay,
        visibility: formValues.visibility,
        isRecurring: formValues.isRecurring,
        recurrence:
          formValues.isRecurring && formValues.repeatEndDate
            ? { daysOfWeek: formValues.daysOfWeek, endDate: formatDate(formValues.repeatEndDate) }
            : undefined,
      },
    ],
  });
}
