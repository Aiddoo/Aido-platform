import { DAY_OF_WEEK_MAP, DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import { addDaysToDateKey, getDayOfWeekOfDateKey } from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  TODO_REPEAT_COUNT,
  TODO_REPEAT_DEFAULT_UNTIL_DAYS,
  TODO_REPEAT_MONTH_DAY_CLAMP_FROM,
} from '../constants/todo-repeat.constants';

export const TODO_EDIT_SCOPES = ['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'] as const;
export const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;

export const TODO_REPEAT_KINDS = [
  'NONE',
  'DAILY',
  'WEEKDAYS',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
] as const;
export type TodoRepeatKind = (typeof TODO_REPEAT_KINDS)[number];

export const TODO_REPEAT_END_TYPES = ['NEVER', 'UNTIL', 'COUNT'] as const;
export type TodoRepeatEndType = (typeof TODO_REPEAT_END_TYPES)[number];

export const todoRepeatEndSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NEVER') }),
  z.object({ type: z.literal('UNTIL'), date: z.iso.date() }),
  z.object({
    type: z.literal('COUNT'),
    count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
  }),
]);
export type TodoRepeatEnd = z.infer<typeof todoRepeatEndSchema>;

export const todoRepeatSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('DAILY'), end: todoRepeatEndSchema }),
  z.object({
    frequency: z.literal('WEEKLY'),
    interval: z.union([z.literal(1), z.literal(2)]),
    weekdays: z.array(z.enum(DAYS_OF_WEEK)).min(1),
    end: todoRepeatEndSchema,
  }),
  z.object({
    frequency: z.literal('MONTHLY'),
    monthDay: z.int().min(1).max(31),
    end: todoRepeatEndSchema,
  }),
]);
export type TodoRepeat = z.infer<typeof todoRepeatSchema>;

export const todoSeriesSchema = z.object({
  id: z.string(),
  repeat: todoRepeatSchema,
  startDate: z.iso.date(),
});
export type TodoSeries = z.infer<typeof todoSeriesSchema>;

const WEEKDAYS: readonly DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const WEEKEND_DAYS: readonly DayOfWeek[] = ['SAT', 'SUN'];

const NEVER_END: TodoRepeatEnd = { type: 'NEVER' };

function sortWeekdays(weekdays: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => weekdays.includes(day));
}

function hasSameWeekdays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

export function getWeekdayOfDateKey(dateKey: string): DayOfWeek {
  const weekday = getDayOfWeekOfDateKey(dateKey);
  return DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === weekday) ?? 'MON';
}

export function getMonthDayOfDateKey(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function getRepeatEndType(repeat: TodoRepeat): TodoRepeatEndType {
  return repeat.end.type;
}

export function getRepeatKind(repeat: TodoRepeat | null): TodoRepeatKind {
  if (repeat == null) {
    return 'NONE';
  }

  return match(repeat)
    .returnType<TodoRepeatKind>()
    .with({ frequency: 'DAILY' }, () => 'DAILY')
    .with({ frequency: 'MONTHLY' }, () => 'MONTHLY')
    .with({ frequency: 'WEEKLY', interval: 2 }, () => 'BIWEEKLY')
    .with({ frequency: 'WEEKLY', interval: 1 }, ({ weekdays }) =>
      match(weekdays)
        .returnType<TodoRepeatKind>()
        .when(
          (days) => days.length === DAYS_OF_WEEK.length,
          () => 'DAILY',
        )
        .when(
          (days) => hasSameWeekdays(days, WEEKDAYS),
          () => 'WEEKDAYS',
        )
        .otherwise(() => 'WEEKLY'),
    )
    .exhaustive();
}

function getKeptWeekdays(repeat: TodoRepeat | null, startDate: string): DayOfWeek[] {
  return repeat?.frequency === 'WEEKLY' ? repeat.weekdays : [getWeekdayOfDateKey(startDate)];
}

export function withRepeatKind(
  repeat: TodoRepeat | null,
  kind: TodoRepeatKind,
  startDate: string,
): TodoRepeat | null {
  const end = repeat?.end ?? NEVER_END;

  return match(kind)
    .returnType<TodoRepeat | null>()
    .with('NONE', () => null)
    .with('DAILY', () => ({ frequency: 'DAILY', end }))
    .with('WEEKDAYS', () => ({
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: [...WEEKDAYS],
      end,
    }))
    .with('WEEKLY', () => ({
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: getKeptWeekdays(repeat, startDate),
      end,
    }))
    .with('BIWEEKLY', () => ({
      frequency: 'WEEKLY',
      interval: 2,
      weekdays: getKeptWeekdays(repeat, startDate),
      end,
    }))
    .with('MONTHLY', () => ({
      frequency: 'MONTHLY',
      monthDay: getMonthDayOfDateKey(startDate),
      end,
    }))
    .exhaustive();
}

export function createRepeat(kind: TodoRepeatKind, startDate: string): TodoRepeat | null {
  return withRepeatKind(null, kind, startDate);
}

export function createWeeklyUntilRepeat(
  weekdays: readonly DayOfWeek[],
  untilDate: string,
): TodoRepeat | null {
  return weekdays.length === 0
    ? null
    : {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: sortWeekdays(weekdays),
        end: { type: 'UNTIL', date: untilDate },
      };
}

export function withRepeatEnd(repeat: TodoRepeat, end: TodoRepeatEnd): TodoRepeat {
  return { ...repeat, end };
}

export function withRepeatEndType(
  repeat: TodoRepeat,
  type: TodoRepeatEndType,
  startDate: string,
): TodoRepeat {
  const end = match(type)
    .returnType<TodoRepeatEnd>()
    .with('NEVER', () => NEVER_END)
    .with('UNTIL', () => ({
      type: 'UNTIL',
      date:
        repeat.end.type === 'UNTIL'
          ? repeat.end.date
          : addDaysToDateKey(startDate, TODO_REPEAT_DEFAULT_UNTIL_DAYS),
    }))
    .with('COUNT', () => ({
      type: 'COUNT',
      count: repeat.end.type === 'COUNT' ? repeat.end.count : TODO_REPEAT_COUNT.DEFAULT,
    }))
    .exhaustive();

  return withRepeatEnd(repeat, end);
}

export function withRepeatCount(repeat: TodoRepeat, count: number): TodoRepeat {
  const clamped = Math.min(Math.max(count, TODO_REPEAT_COUNT.MIN), TODO_REPEAT_COUNT.MAX);
  return withRepeatEnd(repeat, { type: 'COUNT', count: clamped });
}

export function withRepeatUntilDate(repeat: TodoRepeat, date: string): TodoRepeat {
  return withRepeatEnd(repeat, { type: 'UNTIL', date });
}

export function withRepeatWeekdays(repeat: TodoRepeat, weekdays: readonly DayOfWeek[]): TodoRepeat {
  if (repeat.frequency !== 'WEEKLY' || weekdays.length === 0) {
    return repeat;
  }
  return { ...repeat, weekdays: sortWeekdays(weekdays) };
}

export function withRepeatWeekdayToggled(repeat: TodoRepeat, day: DayOfWeek): TodoRepeat {
  if (repeat.frequency !== 'WEEKLY') {
    return repeat;
  }

  const weekdays = repeat.weekdays.includes(day)
    ? repeat.weekdays.filter((selected) => selected !== day)
    : [...repeat.weekdays, day];
  return withRepeatWeekdays(repeat, weekdays);
}

export function withRepeatWeekdayPreset(
  repeat: TodoRepeat,
  preset: 'ALL' | 'WEEKDAYS' | 'WEEKENDS',
): TodoRepeat {
  return withRepeatWeekdays(
    repeat,
    match(preset)
      .returnType<readonly DayOfWeek[]>()
      .with('ALL', () => DAYS_OF_WEEK)
      .with('WEEKDAYS', () => WEEKDAYS)
      .with('WEEKENDS', () => WEEKEND_DAYS)
      .exhaustive(),
  );
}

export function hasRepeatWeekdays(repeat: TodoRepeat, weekdays: readonly DayOfWeek[]): boolean {
  return repeat.frequency === 'WEEKLY' && hasSameWeekdays(repeat.weekdays, weekdays);
}

export function isRepeatMonthDayClamped(repeat: TodoRepeat): boolean {
  return repeat.frequency === 'MONTHLY' && repeat.monthDay >= TODO_REPEAT_MONTH_DAY_CLAMP_FROM;
}

/**
 * 시작일이 바뀌면 시작일에서 따라오는 값(매월 n일, 시작일 요일 하나만 고른 요일)을 맞추고,
 * 시작일보다 앞선 종료일은 시작일로 당긴다.
 */
export function withRepeatStartDate(
  repeat: TodoRepeat,
  previousStartDate: string,
  nextStartDate: string,
): TodoRepeat {
  const adjusted = match(repeat)
    .returnType<TodoRepeat>()
    .with({ frequency: 'DAILY' }, (daily) => daily)
    .with({ frequency: 'MONTHLY' }, (monthly) => ({
      ...monthly,
      monthDay: getMonthDayOfDateKey(nextStartDate),
    }))
    .with({ frequency: 'WEEKLY' }, (weekly) =>
      hasSameWeekdays(weekly.weekdays, [getWeekdayOfDateKey(previousStartDate)])
        ? { ...weekly, weekdays: [getWeekdayOfDateKey(nextStartDate)] }
        : weekly,
    )
    .exhaustive();

  return adjusted.end.type === 'UNTIL' && adjusted.end.date < nextStartDate
    ? withRepeatEnd(adjusted, { type: 'UNTIL', date: nextStartDate })
    : adjusted;
}

export const TodoRepeatPolicy = {
  getKind: getRepeatKind,
  getEndType: getRepeatEndType,
  create: createRepeat,
  createWeeklyUntil: createWeeklyUntilRepeat,
  withKind: withRepeatKind,
  withEndType: withRepeatEndType,
  withCount: withRepeatCount,
  withUntilDate: withRepeatUntilDate,
  withWeekdayToggled: withRepeatWeekdayToggled,
  withWeekdayPreset: withRepeatWeekdayPreset,
  withStartDate: withRepeatStartDate,
  hasWeekdays: hasRepeatWeekdays,
  isMonthDayClamped: isRepeatMonthDayClamped,
} as const;
