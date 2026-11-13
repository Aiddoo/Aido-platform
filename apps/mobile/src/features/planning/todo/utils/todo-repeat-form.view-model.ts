import type { DayOfWeek } from '@aido/api/vocabulary';
import type { DateKey } from '@src/shared/date/date-key';
import { hasSameDaysOfWeek } from '@src/shared/date/day-of-week';
import { without } from 'es-toolkit';

import { TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { toTodoRepeat, type TodoRepeatFormValues } from '../schemas/todo-repeat-form.schema';

function withTodoRepeatFormStartDate(
  values: TodoRepeatFormValues,
  nextStartDate: DateKey,
): TodoRepeatFormValues {
  const next = { ...values, startDate: nextStartDate, monthDay: null };
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return next;
  }

  const adjusted = TodoRepeatPolicy.withRepeatStartDate(repeat, values.startDate, nextStartDate);

  return {
    ...next,
    weekdays: adjusted.frequency === 'WEEKLY' ? adjusted.weekdays : next.weekdays,
    untilDate: adjusted.end.type === 'UNTIL' ? adjusted.end.date : next.untilDate,
  };
}

export function isTodoRepeatFormPreset(
  values: Pick<TodoRepeatFormValues, 'isMonthly' | 'interval' | 'weekdays'>,
  days: readonly DayOfWeek[],
): boolean {
  return !values.isMonthly && values.interval === 1 && hasSameDaysOfWeek(values.weekdays, days);
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
export function getTodoRepeatFormFirstOccurrenceKey(values: TodoRepeatFormValues): DateKey | null {
  const repeat = toTodoRepeat({ ...values, endType: 'NEVER' });
  return repeat == null
    ? null
    : TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(repeat, values.startDate);
}

interface PickedCalendarDate {
  dateKey: DateKey;
  todayKey: DateKey;
}

export function withTodoRepeatFormCalendarDate(
  values: TodoRepeatFormValues,
  { dateKey, todayKey }: PickedCalendarDate,
): TodoRepeatFormValues {
  if (dateKey < todayKey) {
    return values;
  }

  const startDateKey = values.startDate;
  const isFirstOccurrence =
    dateKey === getTodoRepeatFormFirstOccurrenceKey(values) && dateKey !== startDateKey;
  const hasPickedPeriod = values.endType === 'UNTIL' && values.untilDate != null;

  if (isFirstOccurrence || hasPickedPeriod) {
    return { ...withTodoRepeatFormStartDate(values, dateKey), untilDate: null };
  }
  if (dateKey > startDateKey) {
    return { ...values, endType: 'UNTIL', untilDate: dateKey };
  }
  return dateKey < startDateKey ? withTodoRepeatFormStartDate(values, dateKey) : values;
}
