import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import { toLegacyRecurrence } from '@src/features/todo/apis/todo-series.mapper';
import type { AddTodoFormInput } from '@src/features/todo/domains/add-todo-form.schema';
import { formatDateKey } from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';

export function toMemoConversionInput(formValues: AddTodoFormInput): ConvertMemoToTodosInput {
  const startDate = formatDateKey(formValues.startDate, getDeviceTimezone());
  const recurrence =
    formValues.repeat == null ? null : toLegacyRecurrence(formValues.repeat, startDate);

  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: formValues.title,
        categoryId: formValues.categoryId,
        startDate,
        endDate: formValues.endDate
          ? formatDateKey(formValues.endDate, getDeviceTimezone())
          : undefined,
        scheduledTime: formValues.isAllDay ? undefined : (formValues.scheduledTime ?? undefined),
        isAllDay: formValues.isAllDay,
        visibility: formValues.visibility,
        isRecurring: recurrence != null,
        ...(recurrence != null && { recurrence }),
      },
    ],
  });
}
