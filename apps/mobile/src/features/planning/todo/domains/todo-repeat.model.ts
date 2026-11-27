import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  TODO_EDIT_SCOPES,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_CLAMP_FROM,
  TODO_REPEAT_MONTH_DAY_MAX,
  TODO_REPEAT_OCCURRENCE_SEARCH_DAYS,
  TODO_SERIES_LIMITS,
  TODO_UPDATE_SCOPES,
  WEEKDAYS,
  WEEKEND_DAYS,
} from '@aido/api/vocabulary';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  getDayOfMonth,
  getDaysInDateKeyMonth,
  getMondayOfDateKey,
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

const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;
// 수정에는 전체 범위가 없다. 첫 회차에서 이후를 고르면 전체를 고친 것과 같다
const todoUpdateScopeSchema = z.enum(TODO_UPDATE_SCOPES);
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

function withRepeatEnd(repeat: TodoRepeat, end: TodoRepeatEnd): TodoRepeat {
  return { ...repeat, end };
}

function normalizeRepeat(repeat: TodoRepeat | null): TodoRepeat | null {
  if (repeat?.frequency !== 'WEEKLY') {
    return repeat;
  }
  return repeat.interval === 1 && repeat.weekdays.length === DAYS_OF_WEEK.length
    ? { frequency: 'DAILY', end: repeat.end }
    : { ...repeat, weekdays: sortDaysOfWeek(repeat.weekdays) };
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
    monday = addDaysToDateKey(monday, interval * DAYS_OF_WEEK.length)
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

export const TodoRepeatPolicy = {
  // 월~금 매주는 평일, 토·일 매주는 주말로 읽는다. 반복 피커의 평일·주말 칩도 같은 요일 묶음을 고른다
  getRepeatKind(repeat: TodoRepeat): TodoRepeatKind {
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
            (days) => hasSameDaysOfWeek(days, WEEKDAYS),
            () => 'WEEKDAYS',
          )
          .when(
            (days) => hasSameDaysOfWeek(days, WEEKEND_DAYS),
            () => 'WEEKENDS',
          )
          .otherwise(() => 'WEEKLY'),
      )
      .exhaustive();
  },

  isRepeatMonthDayClamped(repeat: TodoRepeat): boolean {
    return repeat.frequency === 'MONTHLY' && repeat.monthDay >= TODO_REPEAT_MONTH_DAY_CLAMP_FROM;
  },

  withRepeatStartDate(
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
  },

  // 저장된 모양이 달라도(7요일 매주·요일 순서) 같은 규칙이면 true. 바뀌지 않은 규칙으로 회차를 나누지 않는다
  hasSameRepeat(repeat: TodoRepeat | null, other: TodoRepeat | null): boolean {
    return isEqual(normalizeRepeat(repeat), normalizeRepeat(other));
  },

  // from~to(포함) 안의 회차 날짜. 시작일 전이거나 종료 조건 뒤는 포함하지 않는다
  getRepeatOccurrenceDateKeys(
    repeat: TodoRepeat,
    startDate: DateKey,
    { from, to }: { from: DateKey; to: DateKey },
  ): DateKey[] {
    return [...walkOccurrenceDateKeys(repeat, startDate, to)].filter((date) => date >= from);
  },

  // 시작일 이후 첫 회차(서버가 처음 만드는 할 일 날짜). 종료 조건 안에 회차가 없으면 null
  findFirstRepeatOccurrenceDateKey(repeat: TodoRepeat, startDate: DateKey): DateKey | null {
    const [first] = walkOccurrenceDateKeys(
      repeat,
      startDate,
      addDaysToDateKey(startDate, TODO_REPEAT_OCCURRENCE_SEARCH_DAYS),
    );
    return first ?? null;
  },

  findLastRepeatOccurrenceDateKey(repeat: TodoRepeat, startDate: DateKey): DateKey | null {
    const limit = match(repeat.end)
      .with({ type: 'NEVER' }, () => null)
      .with({ type: 'UNTIL' }, ({ date }) => date)
      .with({ type: 'COUNT' }, ({ count }) =>
        addDaysToDateKey(startDate, count * TODO_REPEAT_OCCURRENCE_SEARCH_DAYS),
      )
      .exhaustive();
    if (limit == null) {
      return null;
    }
    return [...walkOccurrenceDateKeys(repeat, startDate, limit)].at(-1) ?? null;
  },
};
