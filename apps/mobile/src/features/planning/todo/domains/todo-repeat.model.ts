import {
  DAY_OF_WEEK_MAP,
  DAYS_OF_WEEK,
  type DayOfWeek,
  TODO_EDIT_SCOPES,
  TODO_SERIES_LIMITS,
} from '@aido/api/vocabulary';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  diffDateKeysInDays,
  getDayOfMonth,
  getDayOfWeek,
  getDaysInDateKeyMonth,
  getMondayOfDateKey,
  getMonthEndDateKey,
} from '@src/shared/date/date-key';
import { isEqual } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  TODO_REPEAT_MONTH_DAY_CLAMP_FROM,
  TODO_REPEAT_WEEKDAYS as WEEKDAYS,
  TODO_REPEAT_WEEKEND_DAYS as WEEKEND_DAYS,
} from '../constants/todo-repeat.constants';
import type { TodoEditScope, TodoRepeat, TodoRepeatEnd } from '../schemas/todo-repeat.schema';

const TODO_REPEAT_KINDS = [
  'DAILY',
  'WEEKDAYS',
  'WEEKENDS',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
] as const;
type TodoRepeatKind = (typeof TODO_REPEAT_KINDS)[number];

function sortWeekdays(weekdays: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => weekdays.includes(day));
}

function hasSameWeekdays(weekdays: readonly DayOfWeek[], expected: readonly DayOfWeek[]): boolean {
  return weekdays.length === expected.length && expected.every((day) => weekdays.includes(day));
}

function getWeekday(dateKey: string): DayOfWeek {
  const weekday = getDayOfWeek(dateKey);
  return DAYS_OF_WEEK.find((day) => DAY_OF_WEEK_MAP[day] === weekday) ?? 'MON';
}

function getRepeatKind(repeat: TodoRepeat): TodoRepeatKind {
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
        .when(
          (days) => hasSameWeekdays(days, WEEKEND_DAYS),
          () => 'WEEKENDS',
        )
        .otherwise(() => 'WEEKLY'),
    )
    .exhaustive();
}

function withRepeatEnd(repeat: TodoRepeat, end: TodoRepeatEnd): TodoRepeat {
  return { ...repeat, end };
}

function isRepeatMonthDayClamped(repeat: TodoRepeat): boolean {
  return repeat.frequency === 'MONTHLY' && repeat.monthDay >= TODO_REPEAT_MONTH_DAY_CLAMP_FROM;
}

function withRepeatStartDate(
  repeat: TodoRepeat,
  previousStartDate: string,
  nextStartDate: string,
): TodoRepeat {
  const adjusted = match(repeat)
    .returnType<TodoRepeat>()
    .with({ frequency: 'DAILY' }, (daily) => daily)
    .with({ frequency: 'MONTHLY' }, (monthly) => ({
      ...monthly,
      monthDay: getDayOfMonth(nextStartDate),
    }))
    .with({ frequency: 'WEEKLY' }, (weekly) =>
      hasSameWeekdays(weekly.weekdays, [getWeekday(previousStartDate)])
        ? { ...weekly, weekdays: [getWeekday(nextStartDate)] }
        : weekly,
    )
    .exhaustive();

  return adjusted.end.type === 'UNTIL' && adjusted.end.date < nextStartDate
    ? withRepeatEnd(adjusted, { type: 'UNTIL', date: nextStartDate })
    : adjusted;
}

/** 저장된 모양이 달라도(7요일 매주·요일 순서) 같은 규칙이면 true. 바뀌지 않은 규칙으로 회차를 나누지 않는다 */
function hasSameRepeat(repeat: TodoRepeat | null, other: TodoRepeat | null): boolean {
  return isEqual(normalizeRepeat(repeat), normalizeRepeat(other));
}

function normalizeRepeat(repeat: TodoRepeat | null): TodoRepeat | null {
  if (repeat?.frequency !== 'WEEKLY') {
    return repeat;
  }
  return repeat.interval === 1 && repeat.weekdays.length === DAYS_OF_WEEK.length
    ? { frequency: 'DAILY', end: repeat.end }
    : { ...repeat, weekdays: sortWeekdays(repeat.weekdays) };
}

type TodoEditScopeDecision = 'no-scope' | 'this-only' | 'ask' | 'ask-following-only';

interface TodoEditScopeInput {
  isSeries: boolean;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
  isDateOnly: boolean;
}

/**
 * 수정할 때 범위를 어떻게 정할지. 서버는 반복 회차의 규칙 변경을 THIS_AND_FOLLOWING으로만 받고(그 밖은 TODO_0845)
 * 반복 끝내기는 범위 없이 받으며, 날짜 이동은 범위와 상관없이 이 회차에만 적용한다.
 */
function getTodoEditScopeDecision({
  isSeries,
  repeat,
  isDateOnly,
}: TodoEditScopeInput): TodoEditScopeDecision {
  // nullish-strict: repeat null은 반복 끝내기, 생략은 규칙 유지다
  if (!isSeries || repeat === null) {
    return 'no-scope';
  }
  if (repeat != null) {
    return 'ask-following-only';
  }
  return isDateOnly ? 'this-only' : 'ask';
}

interface RepeatOccurrence {
  recurrenceGroupId: string | null;
  repeat: TodoRepeat | null;
}

/**
 * 규칙이 있는 반복 회차인지. 묶음은 있는데 규칙이 없으면 이관에서 패턴을 알 수 없던
 * 묶음이다. 서버는 이런 묶음의 범위 수정과 반복 끝내기를 받지 않아 "이 할 일만"으로 다룬다.
 */
function hasRepeatRule({ recurrenceGroupId, repeat }: RepeatOccurrence): boolean {
  return recurrenceGroupId != null && repeat != null;
}

/** 반복 칩으로 규칙을 고칠 수 있는지. 규칙 없는 묶음의 회차는 서버가 전환을 받지 않는다(TODO_0845) */
function canChangeRepeat(occurrence: RepeatOccurrence): boolean {
  return occurrence.recurrenceGroupId == null || hasRepeatRule(occurrence);
}

/** 삭제 때 고를 수 있는 범위. 단일 할 일은 묻지 않으므로 비어 있다. 규칙 없는 묶음은 "이후"의 기준이 없다 */
function getDeleteScopes(occurrence: RepeatOccurrence): readonly TodoEditScope[] {
  if (occurrence.recurrenceGroupId == null) {
    return [];
  }
  return hasRepeatRule(occurrence) ? TODO_EDIT_SCOPES : ['THIS_ONLY', 'ALL'];
}

/** 서버 RepeatRule과 같은 규칙: 격주는 시작일이 속한 월요일 시작 주 기준, 매월 n일은 없는 달이면 말일 */
function isOccurrenceDateKey(repeat: TodoRepeat, startDate: string, dateKey: string): boolean {
  return match(repeat)
    .with({ frequency: 'DAILY' }, () => true)
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays }) => {
      const weeks =
        diffDateKeysInDays(getMondayOfDateKey(startDate), getMondayOfDateKey(dateKey)) /
        DAYS_PER_WEEK;
      return weekdays.includes(getWeekday(dateKey)) && weeks % interval === 0;
    })
    .with(
      { frequency: 'MONTHLY' },
      ({ monthDay }) =>
        getDayOfMonth(dateKey) === Math.min(monthDay, getDaysInDateKeyMonth(dateKey)),
    )
    .exhaustive();
}

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
function getRepeatOccurrenceDateKeys(
  repeat: TodoRepeat,
  startDate: string,
  { from, to }: { from: string; to: string },
): string[] {
  return [...walkOccurrenceDateKeys(repeat, startDate, to)].filter((date) => date >= from);
}

/** 시작일 이후 첫 회차(서버가 처음 만드는 할 일 날짜). 종료 조건 안에 회차가 없으면 null */
function findFirstRepeatOccurrenceDateKey(repeat: TodoRepeat, startDate: string): string | null {
  const [first] = walkOccurrenceDateKeys(
    repeat,
    startDate,
    addDaysToDateKey(startDate, OCCURRENCE_SEARCH_DAYS),
  );
  return first ?? null;
}

function findLastRepeatOccurrenceDateKey(repeat: TodoRepeat, startDate: string): string | null {
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

/** 서버가 반복 회차를 미리 만드는 범위(오늘 + VISIBLE_AHEAD_DAYS, 그 날 포함)를 넘어간 날짜인지 */
function isBeyondRepeatHorizon(dateKey: string, todayKey: string): boolean {
  return dateKey > addDaysToDateKey(todayKey, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS);
}

/** 그 날짜가 속한 달의 마지막 날이 미리 만드는 범위를 넘어가는지. 달력에서 일부라도 비어 보일 수 있는 달이다 */
function isMonthBeyondRepeatHorizon(dateKey: string, todayKey: string): boolean {
  return isBeyondRepeatHorizon(getMonthEndDateKey(dateKey), todayKey);
}

export const TodoRepeatPolicy = {
  getWeekday,
  hasSameWeekdays,
  sortWeekdays,
  getRepeatKind,
  hasSameRepeat,
  isBeyondRepeatHorizon,
  isMonthBeyondRepeatHorizon,
  getTodoEditScopeDecision,
  hasRepeatRule,
  canChangeRepeat,
  getDeleteScopes,
  withRepeatStartDate,
  isRepeatMonthDayClamped,
  getRepeatOccurrenceDateKeys,
  findFirstRepeatOccurrenceDateKey,
  findLastRepeatOccurrenceDateKey,
} as const;
