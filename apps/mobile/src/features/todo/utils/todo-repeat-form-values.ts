import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { toDate } from '@src/shared/utils/date';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import { toTodoRepeat, type TodoRepeatFormValues } from '../domains/todo-repeat-form.schema';
import {
  getWeekdayOfDateKey,
  type TodoRepeat,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

/** 시트를 열 때 값이 없으면 시작일의 요일 하나를 고른 상태 + 날짜 종료(종료일 없음)로 시작한다. */
export function toTodoRepeatFormValues(
  startDate: Date,
  repeat: TodoRepeat | null,
): TodoRepeatFormValues {
  const startWeekday = [getWeekdayOfDateKey(toDeviceDateKey(startDate))];
  const base = {
    startDate,
    weekdays: startWeekday,
    interval: 1 as const,
    isMonthly: false,
    monthDay: null,
    endType: 'UNTIL' as const,
    untilDate: null,
    count: TODO_REPEAT_COUNT.DEFAULT,
  };

  if (repeat == null) {
    return base;
  }

  const withEnd = {
    ...base,
    endType: repeat.end.type,
    untilDate: repeat.end.type === 'UNTIL' ? toDate(repeat.end.date) : null,
    count: repeat.end.type === 'COUNT' ? repeat.end.count : base.count,
  };

  return match(repeat)
    .returnType<TodoRepeatFormValues>()
    .with({ frequency: 'DAILY' }, () => ({ ...withEnd, weekdays: [...DAYS_OF_WEEK] }))
    .with({ frequency: 'WEEKLY' }, ({ weekdays, interval }) => ({
      ...withEnd,
      weekdays: [...weekdays],
      interval,
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay }) => ({ ...withEnd, isMonthly: true, monthDay }))
    .exhaustive();
}

/** 시작일이 바뀌면 요일·종료일을 TodoRepeatPolicy로 보정한다 (매월 n일은 옮긴 시작일을 따른다). */
export function withTodoRepeatFormStartDate(
  values: TodoRepeatFormValues,
  nextStartDate: Date,
): TodoRepeatFormValues {
  const next = { ...values, startDate: nextStartDate, monthDay: null };
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return next;
  }

  const adjusted = TodoRepeatPolicy.withRepeatStartDate(
    repeat,
    toDeviceDateKey(values.startDate),
    toDeviceDateKey(nextStartDate),
  );

  return {
    ...next,
    weekdays: adjusted.frequency === 'WEEKLY' ? adjusted.weekdays : next.weekdays,
    untilDate: adjusted.end.type === 'UNTIL' ? toDate(adjusted.end.date) : next.untilDate,
  };
}
