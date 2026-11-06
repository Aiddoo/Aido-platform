import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import {
  isAfterDay,
  isBeforeDay,
  isSameDay,
} from '@src/features/planning/todo/utils/calendar-date';
import { toDate, toDateKey } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { without, xor } from 'es-toolkit';
import { match } from 'ts-pattern';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import { getWeekday, type TodoRepeat, TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { toTodoRepeat, type TodoRepeatFormValues } from '../schemas/todo-repeat-form.schema';

export function toTodoRepeatFormValues(
  startDate: Date,
  repeat: TodoRepeat | null,
): TodoRepeatFormValues {
  const startWeekday = [getWeekday(toDateKey(startDate, getDeviceTimezone()))];
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

function withTodoRepeatFormStartDate(
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
    toDateKey(values.startDate, getDeviceTimezone()),
    toDateKey(nextStartDate, getDeviceTimezone()),
  );

  return {
    ...next,
    weekdays: adjusted.frequency === 'WEEKLY' ? adjusted.weekdays : next.weekdays,
    untilDate: adjusted.end.type === 'UNTIL' ? toDate(adjusted.end.date) : next.untilDate,
  };
}

export function hasSameWeekdays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return xor(a, b).length === 0;
}

export function isTodoRepeatFormPreset(
  values: Pick<TodoRepeatFormValues, 'isMonthly' | 'interval' | 'weekdays'>,
  days: readonly DayOfWeek[],
): boolean {
  return !values.isMonthly && values.interval === 1 && hasSameWeekdays(values.weekdays, days);
}

export function withTodoRepeatFormPreset(
  values: TodoRepeatFormValues,
  days: readonly DayOfWeek[],
): TodoRepeatFormValues {
  return {
    ...values,
    isMonthly: false,
    interval: 1,
    weekdays: isTodoRepeatFormPreset(values, days) ? [] : [...days],
  };
}

export function withTodoRepeatFormBiweeklyToggled(
  values: TodoRepeatFormValues,
): TodoRepeatFormValues {
  return { ...values, isMonthly: false, interval: values.interval === 2 ? 1 : 2 };
}

export function withTodoRepeatFormMonthlyToggled(
  values: TodoRepeatFormValues,
): TodoRepeatFormValues {
  return { ...values, isMonthly: !values.isMonthly, interval: 1 };
}

export function withTodoRepeatFormDayToggled(
  values: TodoRepeatFormValues,
  day: DayOfWeek,
): TodoRepeatFormValues {
  if (values.isMonthly) {
    return { ...values, isMonthly: false, weekdays: [day] };
  }
  return {
    ...values,
    weekdays: values.weekdays.includes(day)
      ? without(values.weekdays, day)
      : [...values.weekdays, day],
  };
}

/** 날짜 종료를 아직 안 골랐어도 첫 회차는 알 수 있으므로 끝이 없는 규칙으로 계산한다. 첫 할 일이 실제로 생기는 날이다 */
export function getTodoRepeatFormFirstOccurrenceKey(values: TodoRepeatFormValues): string | null {
  const repeat = toTodoRepeat({ ...values, endType: 'NEVER' });
  return repeat == null
    ? null
    : TodoRepeatPolicy.getFirstRepeatOccurrenceDateKey(
        repeat,
        toDateKey(values.startDate, getDeviceTimezone()),
      );
}

export function withTodoRepeatFormCalendarDate(
  values: TodoRepeatFormValues,
  date: Date,
  today: Date,
): TodoRepeatFormValues {
  if (isBeforeDay(date, today)) {
    return values;
  }

  const isFirstOccurrence =
    toDateKey(date, getDeviceTimezone()) === getTodoRepeatFormFirstOccurrenceKey(values) &&
    !isSameDay(date, values.startDate);
  const hasPickedPeriod = values.endType === 'UNTIL' && values.untilDate != null;

  if (isFirstOccurrence || hasPickedPeriod) {
    return { ...withTodoRepeatFormStartDate(values, date), untilDate: null };
  }
  if (isAfterDay(date, values.startDate)) {
    return { ...values, endType: 'UNTIL', untilDate: date };
  }
  return isBeforeDay(date, values.startDate) ? withTodoRepeatFormStartDate(values, date) : values;
}
