import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import type { AddTodoFormInput } from '@src/features/todo/domains/add-todo-form.schema';
import { formatDateKey } from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';

export function toMemoConversionInput(formValues: AddTodoFormInput): ConvertMemoToTodosInput {
  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: formValues.title,
        categoryId: formValues.categoryId,
        startDate: formatDateKey(formValues.startDate, getDeviceTimezone()),
        endDate: formValues.endDate
          ? formatDateKey(formValues.endDate, getDeviceTimezone())
          : undefined,
        scheduledTime: formValues.isAllDay ? undefined : (formValues.scheduledTime ?? undefined),
        isAllDay: formValues.isAllDay,
        visibility: formValues.visibility,
        isRecurring: formValues.isRecurring,
        recurrence:
          formValues.isRecurring && formValues.repeatEndDate
            ? {
                daysOfWeek: formValues.daysOfWeek,
                endDate: formatDateKey(formValues.repeatEndDate, getDeviceTimezone()),
              }
            : undefined,
      },
    ],
  });
}
