import { DAY_OF_WEEK_MAP, DAYS_OF_WEEK, type DayOfWeek } from '@aido/api/vocabulary';
import {
  addDaysToDateKey,
  diffDateKeysInDays,
  getDayOfWeekOfDateKey,
} from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  TODO_REPEAT_COUNT,
  TODO_REPEAT_MONTH_DAY_CLAMP_FROM,
  TODO_REPEAT_WEEKDAYS as WEEKDAYS,
} from '../constants/todo-repeat.constants';

export const TODO_EDIT_SCOPES = ['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'] as const;
export const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;

export const TODO_REPEAT_KINDS = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
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

export function getRepeatKind(repeat: TodoRepeat): TodoRepeatKind {
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

const DAYS_PER_WEEK = 7;

function getMondayOfDateKey(dateKey: string): string {
  return addDaysToDateKey(dateKey, -((getDayOfWeekOfDateKey(dateKey) + 6) % DAYS_PER_WEEK));
}

function getDaysInMonthOfDateKey(dateKey: string): number {
  return new Date(
    Date.UTC(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)), 0),
  ).getUTCDate();
}

/** 서버 RepeatRule과 같은 규칙: 격주는 시작일이 속한 월요일 시작 주 기준, 매월 n일은 없는 달이면 말일 */
function isOccurrenceDateKey(repeat: TodoRepeat, startDate: string, dateKey: string): boolean {
  return match(repeat)
    .with({ frequency: 'DAILY' }, () => true)
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays }) => {
      const weeks =
        diffDateKeysInDays(getMondayOfDateKey(startDate), getMondayOfDateKey(dateKey)) /
        DAYS_PER_WEEK;
      return weekdays.includes(getWeekdayOfDateKey(dateKey)) && weeks % interval === 0;
    })
    .with(
      { frequency: 'MONTHLY' },
      ({ monthDay }) =>
        getMonthDayOfDateKey(dateKey) === Math.min(monthDay, getDaysInMonthOfDateKey(dateKey)),
    )
    .exhaustive();
}

/** 시작일부터 종료 조건(날짜·횟수)까지의 회차 날짜. 끝이 없으면 limit(YYYY-MM-DD)까지 */
function* walkOccurrenceDateKeys(
  repeat: TodoRepeat,
  startDate: string,
  limit: string,
): Generator<string> {
  const last = repeat.end.type === 'UNTIL' && repeat.end.date < limit ? repeat.end.date : limit;
  const maxCount = repeat.end.type === 'COUNT' ? repeat.end.count : Number.POSITIVE_INFINITY;
  let count = 0;
  for (let date = startDate; date <= last && count < maxCount; date = addDaysToDateKey(date, 1)) {
    if (isOccurrenceDateKey(repeat, startDate, date)) {
      count += 1;
      yield date;
    }
  }
}

/** 두 회차 사이 최대 간격(격주 2주, 매월 말일 보정 포함)보다 넉넉한 탐색 한도 */
const OCCURRENCE_SEARCH_DAYS = 62;

/** from~to(포함) 안의 회차 날짜. 시작일 전이거나 종료 조건 뒤는 포함하지 않는다 */
export function getRepeatOccurrenceDateKeys(
  repeat: TodoRepeat,
  startDate: string,
  { from, to }: { from: string; to: string },
): string[] {
  return [...walkOccurrenceDateKeys(repeat, startDate, to)].filter((date) => date >= from);
}

/** 시작일 이후 첫 회차(서버가 처음 만드는 할 일 날짜). 종료 조건 안에 회차가 없으면 null */
export function getFirstRepeatOccurrenceDateKey(
  repeat: TodoRepeat,
  startDate: string,
): string | null {
  const [first] = walkOccurrenceDateKeys(
    repeat,
    startDate,
    addDaysToDateKey(startDate, OCCURRENCE_SEARCH_DAYS),
  );
  return first ?? null;
}

/** 날짜·횟수로 끝나는 규칙의 마지막 회차. 끝이 없거나 회차가 없으면 null */
export function getLastRepeatOccurrenceDateKey(
  repeat: TodoRepeat,
  startDate: string,
): string | null {
  const limit = match(repeat.end)
    .with({ type: 'NEVER' }, () => null)
    .with({ type: 'UNTIL' }, ({ date }) => date)
    .with({ type: 'COUNT' }, ({ count }) =>
      addDaysToDateKey(startDate, count * OCCURRENCE_SEARCH_DAYS),
    )
    .exhaustive();
  if (limit == null) {
    return null;
  }
  return [...walkOccurrenceDateKeys(repeat, startDate, limit)].at(-1) ?? null;
}

export const TodoRepeatPolicy = {
  getKind: getRepeatKind,
  createWeeklyUntil: createWeeklyUntilRepeat,
  withStartDate: withRepeatStartDate,
  isMonthDayClamped: isRepeatMonthDayClamped,
  getOccurrenceDateKeys: getRepeatOccurrenceDateKeys,
  getFirstOccurrenceDateKey: getFirstRepeatOccurrenceDateKey,
  getLastOccurrenceDateKey: getLastRepeatOccurrenceDateKey,
} as const;
