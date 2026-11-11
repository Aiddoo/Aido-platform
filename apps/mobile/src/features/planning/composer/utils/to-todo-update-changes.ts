import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { hasScheduleChanged } from '@src/features/planning/todo/domains/todo.model';
import { type Instant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';
import type { TodoUpdateChanges } from '../schemas/todo-change-request.schema';

function toNullableDateKey(date: Instant | null, timeZone: string) {
  return date == null ? null : toDateKey(date, timeZone);
}

function toScheduledTime({ isAllDay, scheduledTime }: AddTodoFormValues) {
  return isAllDay ? null : scheduledTime;
}

/** 수정 폼에서 바뀐 칸만 고른다. 없는 칸은 서버가 그대로 둔다(생략은 유지, null은 비우기) */
export function toTodoUpdateChanges(
  values: AddTodoFormValues,
  defaults: AddTodoFormValues,
  timeZone: string,
): TodoUpdateChanges {
  const startDate = toDateKey(values.startDate, timeZone);
  const endDate = toNullableDateKey(values.endDate, timeZone);
  const scheduledTime = toScheduledTime(values);
  const isScheduleChanged = hasScheduleChanged(
    { isAllDay: values.isAllDay, scheduledTime },
    { isAllDay: defaults.isAllDay, scheduledTime: toScheduledTime(defaults) },
  );

  return {
    input: {
      ...(values.title !== defaults.title && { title: values.title }),
      ...(values.categoryId !== defaults.categoryId && { categoryId: values.categoryId }),
      ...(startDate !== toDateKey(defaults.startDate, timeZone) && { startDate }),
      ...(endDate !== toNullableDateKey(defaults.endDate, timeZone) && { endDate }),
      ...(isScheduleChanged && { scheduledTime, isAllDay: values.isAllDay }),
      ...(values.visibility !== defaults.visibility && { visibility: values.visibility }),
    },
    ...(!TodoRepeatPolicy.hasSameRepeat(values.repeat, defaults.repeat) && {
      repeat: values.repeat,
    }),
  };
}
