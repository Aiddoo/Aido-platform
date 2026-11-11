import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import {
  getScheduledTime,
  hasScheduleChanged,
} from '@src/features/planning/todo/domains/todo.model';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';

import type { TodoUpdateChanges } from '../schemas/todo-change-request.schema';

/** 수정 폼에서 바뀐 칸만 고른다. 없는 칸은 서버가 그대로 둔다(생략은 유지, null은 비우기) */
export function toTodoUpdateChanges(
  values: TodoFormValues,
  defaults: TodoFormValues,
): TodoUpdateChanges {
  const scheduledTime = getScheduledTime(values);
  const isScheduleChanged = hasScheduleChanged(
    { isAllDay: values.isAllDay, scheduledTime },
    { isAllDay: defaults.isAllDay, scheduledTime: getScheduledTime(defaults) },
  );

  return {
    input: {
      ...(values.title !== defaults.title && { title: values.title }),
      ...(values.categoryId !== defaults.categoryId && { categoryId: values.categoryId }),
      ...(values.startDate !== defaults.startDate && { startDate: values.startDate }),
      ...(values.endDate !== defaults.endDate && { endDate: values.endDate }),
      ...(isScheduleChanged && { scheduledTime, isAllDay: values.isAllDay }),
      ...(values.visibility !== defaults.visibility && { visibility: values.visibility }),
    },
    ...(!TodoRepeatPolicy.hasSameRepeat(values.repeat, defaults.repeat) && {
      repeat: values.repeat,
    }),
  };
}
