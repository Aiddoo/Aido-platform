import { TodoRepeatPolicy } from '@src/features/planning/todo/domains/todo-repeat.model';
import { TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import { type TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import type { UpdateTodoInput } from '@src/features/planning/todo/schemas/todo-request.schema';
import { type Instant, toDateKey } from '@src/shared/date/instant';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';

function toNullableDateKey(date: Instant | null, timeZone: string) {
  return date == null ? null : toDateKey(date, timeZone);
}

function toScheduledTime({ isAllDay, scheduledTime }: AddTodoFormValues) {
  return isAllDay ? null : scheduledTime;
}

export interface TodoUpdateChanges {
  input: UpdateTodoInput;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
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
  const isScheduleChanged = TodoPolicy.hasScheduleChanged(
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

export function hasTodoUpdateChanges({ input, repeat }: TodoUpdateChanges): boolean {
  // nullish-strict: repeat null은 반복 끝내기라 변경이다
  return Object.keys(input).length > 0 || repeat !== undefined;
}

/** 날짜 이동은 범위와 상관없이 이 회차에만 적용되므로 범위를 묻지 않는다 */
export function hasOnlyDateChanges({ input, repeat }: TodoUpdateChanges): boolean {
  // nullish-strict: repeat null도 날짜 밖의 변경이다
  if (repeat !== undefined) {
    return false;
  }
  const fields = Object.keys(input);
  return fields.length > 0 && fields.every((field) => field === 'startDate' || field === 'endDate');
}
