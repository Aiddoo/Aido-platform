import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import { toRepeatDto } from '@src/features/todo/apis/todo-series.mapper';
import type { AddTodoFormValues } from '@src/features/todo/domains/add-todo-form.schema';
import { formatDateKey } from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';

export function toMemoConversionInput(formValues: AddTodoFormValues): ConvertMemoToTodosInput {
  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: formValues.title,
        categoryId: formValues.categoryId,
        startDate: formatDateKey(formValues.startDate, getDeviceTimezone()),
        endDate:
          formValues.endDate == null
            ? undefined
            : formatDateKey(formValues.endDate, getDeviceTimezone()),
        scheduledTime: formValues.isAllDay ? undefined : (formValues.scheduledTime ?? undefined),
        isAllDay: formValues.isAllDay,
        visibility: formValues.visibility,
        ...(formValues.repeat != null && { repeat: toRepeatDto(formValues.repeat) }),
      },
    ],
  });
}
