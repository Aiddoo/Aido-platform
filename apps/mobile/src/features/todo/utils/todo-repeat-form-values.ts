import { DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { isAfterDay, isBeforeDay, isSameDay, toDate } from '@src/shared/utils/date';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { without, xor } from 'es-toolkit';
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

export function hasSameWeekdays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return xor(a, b).length === 0;
}

/** 프리셋은 매주 반복일 때만 켜진 것으로 본다 */
export function isTodoRepeatFormPreset(
  values: Pick<TodoRepeatFormValues, 'isMonthly' | 'interval' | 'weekdays'>,
  days: readonly DayOfWeek[],
): boolean {
  return !values.isMonthly && values.interval === 1 && hasSameWeekdays(values.weekdays, days);
}

/** 켜진 프리셋을 다시 누르면 요일을 비운다 */
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

/** 매월에서 요일을 누르면 그 요일 하나로 돌아간다 */
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
    : TodoRepeatPolicy.getFirstRepeatOccurrenceDateKey(repeat, toDeviceDateKey(values.startDate));
}

/**
 * 달력에서 날짜를 눌렀을 때의 다음 값. 지난 날은 고를 수 없다.
 * 첫 회차를 누르거나 기간을 이미 골랐으면 그 날부터 다시 시작하고, 시작일 뒤는 종료일, 앞은 시작일이 된다.
 */
export function withTodoRepeatFormCalendarDate(
  values: TodoRepeatFormValues,
  date: Date,
  today: Date,
): TodoRepeatFormValues {
  if (isBeforeDay(date, today)) {
    return values;
  }

  const isFirstOccurrence =
    toDeviceDateKey(date) === getTodoRepeatFormFirstOccurrenceKey(values) &&
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
