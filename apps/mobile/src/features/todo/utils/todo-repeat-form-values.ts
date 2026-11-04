import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { toDate } from '@src/shared/utils/date';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import type { TodoRepeatFormValues } from '../domains/todo-repeat-form.schema';
import {
  getMonthDayOfDateKey,
  getWeekdayOfDateKey,
  type TodoRepeat,
  type TodoRepeatEnd,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

const WEEK_LENGTH = 7;

function sortWeekdays(weekdays: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => weekdays.includes(day));
}

/** 시트를 열 때 값이 없으면 시작일의 요일 하나를 고른 상태 + 계속으로 시작한다. */
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
    .with({ frequency: 'MONTHLY' }, () => ({ ...withEnd, isMonthly: true }))
    .exhaustive();
}

function toTodoRepeatEnd(values: TodoRepeatFormValues): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null ? null : { type: 'UNTIL', date: toDeviceDateKey(values.untilDate) },
    )
    .with('COUNT', () => ({ type: 'COUNT', count: values.count }))
    .exhaustive();
}

/** 요일이 없거나 날짜 종료인데 종료일이 없으면 반복을 만들 수 없다. */
export function toTodoRepeat(values: TodoRepeatFormValues): TodoRepeat | null {
  const end = toTodoRepeatEnd(values);
  if (end == null) {
    return null;
  }

  if (values.isMonthly) {
    return {
      frequency: 'MONTHLY',
      monthDay: getMonthDayOfDateKey(toDeviceDateKey(values.startDate)),
      end,
    };
  }

  if (values.weekdays.length === 0) {
    return null;
  }

  if (values.interval === 1 && values.weekdays.length === WEEK_LENGTH) {
    return { frequency: 'DAILY', end };
  }

  return {
    frequency: 'WEEKLY',
    interval: values.interval,
    weekdays: sortWeekdays(values.weekdays),
    end,
  };
}

/** 요일을 고르지 않았거나, 날짜 종료인데 종료일이 없거나 기간 안에 회차가 없으면 확인할 수 없다. */
export function canConfirmTodoRepeatForm(values: TodoRepeatFormValues): boolean {
  const repeat = toTodoRepeat(values);
  return (
    repeat != null &&
    TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, toDeviceDateKey(values.startDate)) != null
  );
}

/** 시작일이 바뀌면 요일·종료일을 TodoRepeatPolicy로 보정한다 (매월 n일은 시작일에서 따라온다). */
export function withTodoRepeatFormStartDate(
  values: TodoRepeatFormValues,
  nextStartDate: Date,
): TodoRepeatFormValues {
  const next = { ...values, startDate: nextStartDate };
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return next;
  }

  const adjusted = TodoRepeatPolicy.withStartDate(
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
