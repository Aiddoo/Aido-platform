import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  TODO_REPEAT_END_TYPES,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_MAX,
} from '@aido/api/vocabulary';
import { type DateKey, dateKeyFieldSchema, getDayOfMonth } from '@src/shared/date/date-key';
import {
  getDateKeyDayOfWeek,
  hasSameDaysOfWeek,
  sortDaysOfWeek,
} from '@src/shared/date/day-of-week';
import { without } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TODO_REPEAT_DEFAULT_COUNT } from '../constants/todo-repeat.constants';
import {
  type TodoRepeat,
  todoRepeatCountSchema,
  type TodoRepeatEnd,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

const todoRepeatFormShape = z.object({
  startDate: dateKeyFieldSchema,
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.literal(TODO_REPEAT_INTERVALS),
  isMonthly: z.boolean(),
  /** 규칙이 가진 매월 며칠. 시작일을 옮기기 전까지 유지해 2월 28일 회차에서 열어도 31일 규칙이 그대로다. 없으면 시작일을 따른다 */
  monthDay: z.int().min(1).max(TODO_REPEAT_MONTH_DAY_MAX).nullable(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: dateKeyFieldSchema.nullable(),
  count: todoRepeatCountSchema,
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormShape>;

/** 반복을 처음 정할 때의 값. 시작일의 요일에 매주 하고 끝 날짜는 아직 고르지 않았다 */
export function createTodoRepeatFormValues(startDate: DateKey): TodoRepeatFormValues {
  return {
    startDate,
    weekdays: [getDateKeyDayOfWeek(startDate)],
    interval: 1,
    isMonthly: false,
    monthDay: null,
    endType: 'UNTIL',
    untilDate: null,
    count: TODO_REPEAT_DEFAULT_COUNT,
  };
}

export function getTodoRepeatFormMonthDay({
  monthDay,
  startDate,
}: Pick<TodoRepeatFormValues, 'monthDay' | 'startDate'>): number {
  return monthDay ?? getDayOfMonth(startDate);
}

function toTodoRepeatEnd(values: TodoRepeatFormValues): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null ? null : { type: 'UNTIL', date: values.untilDate },
    )
    .with('COUNT', () => ({ type: 'COUNT', count: values.count }))
    .exhaustive();
}

// 폼 검사(.check)가 규칙으로 바뀌는지로 판정해 스키마 옆에 둔다. mapper로 옮기면 스키마가 apis를 본다
export function toTodoRepeat(values: TodoRepeatFormValues): TodoRepeat | null {
  const end = toTodoRepeatEnd(values);
  if (end == null) {
    return null;
  }

  if (values.isMonthly) {
    return {
      frequency: 'MONTHLY',
      monthDay: getTodoRepeatFormMonthDay(values),
      end,
    };
  }

  if (values.weekdays.length === 0) {
    return null;
  }

  if (values.interval === 1 && values.weekdays.length === DAYS_OF_WEEK.length) {
    return { frequency: 'DAILY', end };
  }

  return {
    frequency: 'WEEKLY',
    interval: values.interval,
    weekdays: sortDaysOfWeek(values.weekdays),
    end,
  };
}

export type TodoRepeatFormIssue = 'no-weekdays' | 'until-required' | 'no-occurrence';

export function findTodoRepeatFormIssue(values: TodoRepeatFormValues): TodoRepeatFormIssue | null {
  if (!values.isMonthly && values.weekdays.length === 0) {
    return 'no-weekdays';
  }
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return 'until-required';
  }
  return TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(repeat, values.startDate) == null
    ? 'no-occurrence'
    : null;
}

const ISSUE_PATH = {
  'no-weekdays': 'weekdays',
  'until-required': 'untilDate',
  'no-occurrence': 'untilDate',
} as const satisfies Record<TodoRepeatFormIssue, keyof TodoRepeatFormValues>;

export const todoRepeatFormSchema = todoRepeatFormShape.check(({ value, issues }) => {
  const issue = findTodoRepeatFormIssue(value);
  if (issue != null) {
    issues.push({ code: 'custom', input: value, message: issue, path: [ISSUE_PATH[issue]] });
  }
});

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
export function findTodoRepeatFormFirstOccurrenceKey(values: TodoRepeatFormValues): DateKey | null {
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
    dateKey === findTodoRepeatFormFirstOccurrenceKey(values) && dateKey !== startDateKey;
  const hasPickedPeriod = values.endType === 'UNTIL' && values.untilDate != null;

  if (isFirstOccurrence || hasPickedPeriod) {
    return { ...withTodoRepeatFormStartDate(values, dateKey), untilDate: null };
  }
  if (dateKey > startDateKey) {
    return { ...values, endType: 'UNTIL', untilDate: dateKey };
  }
  return dateKey < startDateKey ? withTodoRepeatFormStartDate(values, dateKey) : values;
}
