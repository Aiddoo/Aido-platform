import type { UpdateTodoInput } from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';

import type { AddTodoFormValues } from '../domains/add-todo-form.schema';
import { TodoRepeatPolicy, type TodoRepeat } from '../domains/todo-repeat.model';

const toDateKey = (date: Date) => formatDateKey(date, getDeviceTimezone());
const toNullableDateKey = (date: Date | null) => (date == null ? null : toDateKey(date));
const toScheduledTime = ({ isAllDay, scheduledTime }: AddTodoFormValues) =>
  isAllDay ? null : scheduledTime;

export interface TodoUpdateChanges {
  input: UpdateTodoInput;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
}

/** 수정 폼에서 바뀐 칸만 고른다. 없는 칸은 서버가 그대로 둔다(생략은 유지, null은 비우기) */
export function toTodoUpdateChanges(
  values: AddTodoFormValues,
  defaults: AddTodoFormValues,
): TodoUpdateChanges {
  const startDate = toDateKey(values.startDate);
  const endDate = toNullableDateKey(values.endDate);
  const scheduledTime = toScheduledTime(values);
  const isScheduleChanged =
    values.isAllDay !== defaults.isAllDay || scheduledTime !== toScheduledTime(defaults);

  return {
    input: {
      ...(values.title !== defaults.title && { title: values.title }),
      ...(values.categoryId !== defaults.categoryId && { categoryId: values.categoryId }),
      ...(startDate !== toDateKey(defaults.startDate) && { startDate }),
      ...(endDate !== toNullableDateKey(defaults.endDate) && { endDate }),
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
