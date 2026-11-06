import { convertMemoToTodosSchema, type ConvertMemoToTodosInput } from '@aido/api';
import { toRepeatDto } from '@src/features/todo/apis/todo-series.mapper';
import type { AddTodoFormValues } from '@src/features/todo/domains/add-todo-form.schema';
import { toDateKey } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';

export function toMemoConversionInput(formValues: AddTodoFormValues): ConvertMemoToTodosInput {
  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: formValues.title,
        categoryId: formValues.categoryId,
        startDate: toDateKey(formValues.startDate, getDeviceTimezone()),
        endDate:
          formValues.endDate == null
            ? undefined
            : toDateKey(formValues.endDate, getDeviceTimezone()),
        scheduledTime: formValues.isAllDay ? undefined : (formValues.scheduledTime ?? undefined),
        isAllDay: formValues.isAllDay,
        visibility: formValues.visibility,
        ...(formValues.repeat != null && { repeat: toRepeatDto(formValues.repeat) }),
      },
    ],
  });
}
