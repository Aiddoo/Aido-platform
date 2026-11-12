import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  TODO_EDIT_SCOPES,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_CLAMP_FROM,
  TODO_REPEAT_MONTH_DAY_MAX,
  TODO_SERIES_LIMITS,
  TODO_UPDATE_SCOPES,
} from '@aido/api/vocabulary';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  getDayOfMonth,
  getDaysInDateKeyMonth,
  getMondayOfDateKey,
  getMonthEndDateKey,
  getMonthStartDateKey,
  dateKeyFieldSchema,
  type DateKey,
} from '@src/shared/date/date-key';
import {
  getDateKeyDayOfWeek,
  hasSameDaysOfWeek,
  sortDaysOfWeek,
} from '@src/shared/date/day-of-week';
import { isEqual } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

/** 반복을 횟수로 끝낼 때의 범위. 서버 시리즈 한도와 같다 */
export const todoRepeatCountSchema = z.int().min(1).max(TODO_SERIES_LIMITS.MAX_COUNT);

/** 평일·주말 반복으로 읽는 요일 묶음. 반복 피커의 평일·주말 칩도 같은 요일을 고른다 */
const REPEAT_PRESET_DAYS = {
  WEEKDAYS: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  WEEKENDS: ['SAT', 'SUN'],
} as const satisfies Record<'WEEKDAYS' | 'WEEKENDS', readonly DayOfWeek[]>;
type RepeatPreset = keyof typeof REPEAT_PRESET_DAYS;

export function getRepeatPresetDays(preset: RepeatPreset): readonly DayOfWeek[] {
  return REPEAT_PRESET_DAYS[preset];
}

const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;
// 수정에는 전체 범위가 없다. 첫 회차에서 이후를 고르면 전체를 고친 것과 같다
export const todoUpdateScopeSchema = z.enum(TODO_UPDATE_SCOPES);
export type TodoUpdateScope = z.infer<typeof todoUpdateScopeSchema>;

// 할 일·음성 계획 폼이 이 규칙을 그대로 쓰므로 폼 입력도 날짜 key다
const todoRepeatEndSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NEVER') }),
  z.object({ type: z.literal('UNTIL'), date: dateKeyFieldSchema }),
  z.object({
    type: z.literal('COUNT'),
    count: todoRepeatCountSchema,
  }),
]);
export type TodoRepeatEnd = z.infer<typeof todoRepeatEndSchema>;

export const todoRepeatSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('DAILY'), end: todoRepeatEndSchema }),
  z.object({
    frequency: z.literal('WEEKLY'),
    interval: z.literal(TODO_REPEAT_INTERVALS),
    weekdays: z.array(z.enum(DAYS_OF_WEEK)).min(1),
    end: todoRepeatEndSchema,
  }),
  z.object({
    frequency: z.literal('MONTHLY'),
    monthDay: z.int().min(1).max(TODO_REPEAT_MONTH_DAY_MAX),
    end: todoRepeatEndSchema,
  }),
]);
export type TodoRepeat = z.infer<typeof todoRepeatSchema>;

const TODO_REPEAT_KINDS = [
  'DAILY',
  'WEEKDAYS',
  'WEEKENDS',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
] as const;
type TodoRepeatKind = (typeof TODO_REPEAT_KINDS)[number];

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
          (days) => hasSameDaysOfWeek(days, REPEAT_PRESET_DAYS.WEEKDAYS),
          () => 'WEEKDAYS',
        )
        .when(
          (days) => hasSameDaysOfWeek(days, REPEAT_PRESET_DAYS.WEEKENDS),
          () => 'WEEKENDS',
        )
        .otherwise(() => 'WEEKLY'),
    )
    .exhaustive();
}

function withRepeatEnd(repeat: TodoRepeat, end: TodoRepeatEnd): TodoRepeat {
  return { ...repeat, end };
}

export function isRepeatMonthDayClamped(repeat: TodoRepeat): boolean {
  return repeat.frequency === 'MONTHLY' && repeat.monthDay >= TODO_REPEAT_MONTH_DAY_CLAMP_FROM;
}

export function withRepeatStartDate(
  repeat: TodoRepeat,
  previousStartDate: DateKey,
  nextStartDate: DateKey,
): TodoRepeat {
  const adjusted = match(repeat)
    .returnType<TodoRepeat>()
    .with({ frequency: 'DAILY' }, (daily) => daily)
    .with({ frequency: 'MONTHLY' }, (monthly) => ({
      ...monthly,
      monthDay: getDayOfMonth(nextStartDate),
    }))
    .with({ frequency: 'WEEKLY' }, (weekly) =>
      hasSameDaysOfWeek(weekly.weekdays, [getDateKeyDayOfWeek(previousStartDate)])
        ? { ...weekly, weekdays: [getDateKeyDayOfWeek(nextStartDate)] }
        : weekly,
    )
    .exhaustive();

  return adjusted.end.type === 'UNTIL' && adjusted.end.date < nextStartDate
    ? withRepeatEnd(adjusted, { type: 'UNTIL', date: nextStartDate })
    : adjusted;
}

// 저장된 모양이 달라도(7요일 매주·요일 순서) 같은 규칙이면 true. 바뀌지 않은 규칙으로 회차를 나누지 않는다
export function hasSameRepeat(repeat: TodoRepeat | null, other: TodoRepeat | null): boolean {
  return isEqual(normalizeRepeat(repeat), normalizeRepeat(other));
}

function normalizeRepeat(repeat: TodoRepeat | null): TodoRepeat | null {
  if (repeat?.frequency !== 'WEEKLY') {
    return repeat;
  }
  return repeat.interval === 1 && repeat.weekdays.length === DAYS_OF_WEEK.length
    ? { frequency: 'DAILY', end: repeat.end }
    : { ...repeat, weekdays: sortDaysOfWeek(repeat.weekdays) };
}

type TodoEditScopeDecision = 'no-scope' | 'this-only' | 'ask' | 'ask-following-only';

interface TodoEditScopeInput {
  isSeries: boolean;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
  isDateOnly: boolean;
}

// 서버는 회차 규칙 변경을 THIS_AND_FOLLOWING으로만(TODO_0845), 끝내기는 범위 없이 받고 날짜 이동은 이 회차에만 적용한다
export function getTodoEditScopeDecision({
  isSeries,
  repeat,
  isDateOnly,
}: TodoEditScopeInput): TodoEditScopeDecision {
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기, 생략은 규칙 유지다
  if (!isSeries || repeat === null) {
    return 'no-scope';
  }
  if (repeat != null) {
    return 'ask-following-only';
  }
  return isDateOnly ? 'this-only' : 'ask';
}

// 서버 RepeatRule과 같은 걷기: 하루씩 보지 않고 규칙이 맞는 날로 건너뛴다. 격주는 시작일이 속한 월요일 시작 주 기준이다
function* walkDailyDateKeys(startDate: DateKey, upper: DateKey): Generator<DateKey> {
  for (let date = startDate; date <= upper; date = addDaysToDateKey(date, 1)) {
    yield date;
  }
}

interface WeeklyWalk {
  startDate: DateKey;
  upper: DateKey;
  interval: number;
  weekdays: readonly DayOfWeek[];
}

function* walkWeeklyDateKeys({
  startDate,
  upper,
  interval,
  weekdays,
}: WeeklyWalk): Generator<DateKey> {
  const offsets = sortDaysOfWeek(weekdays).map((weekday) => DAYS_OF_WEEK.indexOf(weekday));
  for (
    let monday = getMondayOfDateKey(startDate);
    monday <= upper;
    monday = addDaysToDateKey(monday, interval * DAYS_PER_WEEK)
  ) {
    for (const offset of offsets) {
      const date = addDaysToDateKey(monday, offset);
      if (date > upper) {
        return;
      }
      if (date >= startDate) {
        yield date;
      }
    }
  }
}

// 매월 n일은 그날이 없는 달이면 말일이다
function* walkMonthlyDateKeys(
  startDate: DateKey,
  upper: DateKey,
  monthDay: number,
): Generator<DateKey> {
  for (
    let monthStart = getMonthStartDateKey(startDate);
    monthStart <= upper;
    monthStart = addMonthsToDateKey(monthStart, 1)
  ) {
    const date = addDaysToDateKey(
      monthStart,
      Math.min(monthDay, getDaysInDateKeyMonth(monthStart)) - 1,
    );
    if (date > upper) {
      return;
    }
    if (date >= startDate) {
      yield date;
    }
  }
}

function walkRuleDateKeys(
  repeat: TodoRepeat,
  startDate: DateKey,
  upper: DateKey,
): Generator<DateKey> {
  return match(repeat)
    .with({ frequency: 'DAILY' }, () => walkDailyDateKeys(startDate, upper))
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays }) =>
      walkWeeklyDateKeys({ startDate, upper, interval, weekdays }),
    )
    .with({ frequency: 'MONTHLY' }, ({ monthDay }) =>
      walkMonthlyDateKeys(startDate, upper, monthDay),
    )
    .exhaustive();
}

// 횟수 종료는 시작일부터 센다
function* walkOccurrenceDateKeys(
  repeat: TodoRepeat,
  startDate: DateKey,
  limit: DateKey,
): Generator<DateKey> {
  const last = repeat.end.type === 'UNTIL' && repeat.end.date < limit ? repeat.end.date : limit;
  const maxCount = repeat.end.type === 'COUNT' ? repeat.end.count : Number.POSITIVE_INFINITY;
  let count = 0;
  for (const date of walkRuleDateKeys(repeat, startDate, last)) {
    if (count >= maxCount) {
      return;
    }
    count += 1;
    yield date;
  }
}

// 두 회차 사이 최대 간격(격주 2주, 매월 말일 보정 포함)보다 넉넉한 탐색 한도
const OCCURRENCE_SEARCH_DAYS = 62;

// from~to(포함) 안의 회차 날짜. 시작일 전이거나 종료 조건 뒤는 포함하지 않는다
export function getRepeatOccurrenceDateKeys(
  repeat: TodoRepeat,
  startDate: DateKey,
  { from, to }: { from: DateKey; to: DateKey },
): DateKey[] {
  return [...walkOccurrenceDateKeys(repeat, startDate, to)].filter((date) => date >= from);
}

// 시작일 이후 첫 회차(서버가 처음 만드는 할 일 날짜). 종료 조건 안에 회차가 없으면 null
export function findFirstRepeatOccurrenceDateKey(
  repeat: TodoRepeat,
  startDate: DateKey,
): DateKey | null {
  const [first] = walkOccurrenceDateKeys(
    repeat,
    startDate,
    addDaysToDateKey(startDate, OCCURRENCE_SEARCH_DAYS),
  );
  return first ?? null;
}

export function findLastRepeatOccurrenceDateKey(
  repeat: TodoRepeat,
  startDate: DateKey,
): DateKey | null {
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

// 서버가 반복 회차를 미리 만드는 범위(오늘 + VISIBLE_AHEAD_DAYS, 그 날 포함)를 넘어간 날짜인지
export function isBeyondRepeatHorizon(dateKey: DateKey, todayKey: DateKey): boolean {
  return dateKey > addDaysToDateKey(todayKey, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS);
}

// 그 날짜가 속한 달의 마지막 날이 미리 만드는 범위를 넘어가는지. 달력에서 일부라도 비어 보일 수 있는 달이다
export function isMonthBeyondRepeatHorizon(dateKey: DateKey, todayKey: DateKey): boolean {
  return isBeyondRepeatHorizon(getMonthEndDateKey(dateKey), todayKey);
}

export const TodoRepeatPolicy = {
  getRepeatKind,
  hasSameRepeat,
  withRepeatStartDate,
  isRepeatMonthDayClamped,
  getRepeatOccurrenceDateKeys,
  findFirstRepeatOccurrenceDateKey,
  findLastRepeatOccurrenceDateKey,
} as const;
