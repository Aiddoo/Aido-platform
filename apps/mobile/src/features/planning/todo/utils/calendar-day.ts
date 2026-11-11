import { getDayOfWeek } from '@src/shared/date/date-key';
import { toDateKey } from '@src/shared/date/zoned';
import type { TextTone } from '@src/shared/ui';

import { isAfterDay, isBeforeDay, isSameDay, isSameMonth } from './calendar-day-comparison';

const SUNDAY = 0;
const SATURDAY = 6;

export type CalendarDayType = 'selected' | 'today' | 'sunday' | 'saturday' | 'default';

interface CalendarDayInput {
  date: Date;
  isSelected: boolean;
  /** 렌더 중 new Date()를 만들지 않도록 useToday()의 오늘을 받는다. */
  today: Date;
  timeZone: string;
}

export function getDatePickerDayType({
  date,
  isSelected,
  today,
  timeZone,
}: CalendarDayInput): CalendarDayType {
  if (isSelected) {
    return 'selected';
  }
  if (isSameDay(date, today, timeZone)) {
    return 'today';
  }
  if (getDayOfWeek(toDateKey(date, timeZone)) === SUNDAY) {
    return 'sunday';
  }
  if (getDayOfWeek(toDateKey(date, timeZone)) === SATURDAY) {
    return 'saturday';
  }
  return 'default';
}

interface MonthViewDayInput {
  dateKey: string;
  selectedDateKey: string;
  todayKey: string;
}

/** 피드 달력 칸의 선택·글자색·오늘 강조. 날짜 키만 비교해 칸마다 Intl로 날짜를 다시 읽지 않는다 */
export function getMonthViewDayState({ dateKey, selectedDateKey, todayKey }: MonthViewDayInput) {
  const isSelected = dateKey === selectedDateKey;
  const isToday = dateKey === todayKey;

  return {
    isSelected,
    dayType: getMonthViewDayType({ dayOfWeek: getDayOfWeek(dateKey), isSelected, isToday }),
    isTodayHighlighted: !isSelected && isToday,
  };
}

function getMonthViewDayType({
  dayOfWeek,
  isSelected,
  isToday,
}: {
  dayOfWeek: number;
  isSelected: boolean;
  isToday: boolean;
}): CalendarDayType {
  if (isSelected) {
    return 'selected';
  }
  if (dayOfWeek === SUNDAY) {
    return 'sunday';
  }
  if (dayOfWeek === SATURDAY) {
    return 'saturday';
  }
  if (isToday) {
    return 'today';
  }
  return 'default';
}

export function isTodayHighlighted({ date, isSelected, today, timeZone }: CalendarDayInput) {
  return !isSelected && isSameDay(date, today, timeZone);
}

export const DAY_TYPE_TONE: Record<CalendarDayType, TextTone> = {
  selected: 'white',
  today: 'brand',
  sunday: 'danger',
  saturday: 'info',
  default: 'neutral',
};

interface WeekRangeDay {
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

/** 한 주의 기간 띠가 차지하는 구간(주 폭에 대한 0..1). 시작·끝 날은 칸 가운데까지만 칠한다. 띠가 없으면 null이다 */
export function getWeekRangeBand(
  days: readonly WeekRangeDay[],
): { startRatio: number; endRatio: number } | null {
  const spans = days.flatMap(({ isInRange, isRangeStart, isRangeEnd }, index) => {
    if (isInRange) {
      return [[index, index + 1]];
    }
    if (isRangeStart) {
      return [[index + 0.5, index + 1]];
    }
    return isRangeEnd ? [[index, index + 0.5]] : [];
  });
  const [first] = spans;
  const last = spans.at(-1);
  if (first == null || last == null) {
    return null;
  }

  return { startRatio: (first[0] ?? 0) / days.length, endRatio: (last[1] ?? 0) / days.length };
}

interface RepeatWeekPeriod {
  displayMonth: Date;
  startDate: Date;
  endDate: Date | null;
  isOpenEnded: boolean;
  timeZone: string;
}

/** 반복 달력 한 주의 칸마다 시작·끝과 기간 띠에 드는지 정한다. 다른 달의 칸은 띠에 넣지 않는다 */
export function getRepeatWeekDays(
  week: readonly Date[],
  { displayMonth, startDate, endDate, isOpenEnded, timeZone }: RepeatWeekPeriod,
) {
  const hasDistinctRange =
    isOpenEnded || (endDate != null && !isSameDay(startDate, endDate, timeZone));

  return week.map((date) => {
    const isVisible = isSameMonth(date, displayMonth, timeZone);
    const isStart = isSameDay(date, startDate, timeZone);
    const isEnd = endDate != null && isSameDay(date, endDate, timeZone);

    return {
      date,
      isVisible,
      isStart,
      isEnd,
      isInRange:
        isVisible &&
        hasDistinctRange &&
        isAfterDay(date, startDate, timeZone) &&
        (isOpenEnded || (endDate != null && isBeforeDay(date, endDate, timeZone))),
      isRangeStart: isVisible && hasDistinctRange && isStart,
      isRangeEnd: isVisible && !isOpenEnded && hasDistinctRange && isEnd,
    };
  });
}
