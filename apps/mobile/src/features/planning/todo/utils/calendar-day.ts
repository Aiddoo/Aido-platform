import type { DateKey } from '@src/shared/date/date-key';
import type { TextTone } from '@src/shared/ui';

import type { CalendarDayCell } from './calendar-month.view-model';

const SUNDAY = 0;
const SATURDAY = 6;

export type CalendarDayType = 'selected' | 'today' | 'sunday' | 'saturday' | 'default';

interface DayTypeInput {
  dayOfWeek: number;
  isSelected: boolean;
  isToday: boolean;
}

/** 피커 칸의 글자색. 오늘이 주말 색보다 앞선다 */
export function getPickerDayType({
  dayOfWeek,
  isSelected,
  isToday,
}: DayTypeInput): CalendarDayType {
  if (isSelected) {
    return 'selected';
  }
  if (isToday) {
    return 'today';
  }
  if (dayOfWeek === SUNDAY) {
    return 'sunday';
  }
  if (dayOfWeek === SATURDAY) {
    return 'saturday';
  }
  return 'default';
}

interface MonthViewDayInput {
  dateKey: DateKey;
  /** 쪽을 만들 때 한 번 구한 요일 */
  dayOfWeek: number;
  selectedDateKey: DateKey;
  todayKey: DateKey;
}

/** 피드 달력 칸의 선택·글자색·오늘 강조. 날짜 키만 비교해 칸마다 날짜를 다시 읽지 않는다 */
export function getMonthViewDayState({
  dateKey,
  dayOfWeek,
  selectedDateKey,
  todayKey,
}: MonthViewDayInput) {
  const isSelected = dateKey === selectedDateKey;
  const isToday = dateKey === todayKey;

  return {
    isSelected,
    dayType: getMonthViewDayType({ dayOfWeek, isSelected, isToday }),
    isTodayHighlighted: !isSelected && isToday,
  };
}

/** 피드 달력은 주말 색이 오늘보다 앞선다 */
function getMonthViewDayType({ dayOfWeek, isSelected, isToday }: DayTypeInput): CalendarDayType {
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
  startDateKey: DateKey;
  endDateKey: DateKey | null;
  isOpenEnded: boolean;
}

/** 반복 달력 한 주의 칸마다 시작·끝과 기간 띠에 드는지 정한다. 다른 달의 칸은 띠에 넣지 않는다 */
export function getRepeatWeekDays(
  week: readonly CalendarDayCell[],
  { startDateKey, endDateKey, isOpenEnded }: RepeatWeekPeriod,
) {
  const hasDistinctRange = isOpenEnded || (endDateKey != null && startDateKey !== endDateKey);

  return week.map((cell) => {
    const { dateKey } = cell;
    const isVisible = !cell.isOutsideMonth;
    const isStart = dateKey === startDateKey;
    const isEnd = dateKey === endDateKey;

    return {
      cell,
      isVisible,
      isStart,
      isEnd,
      isInRange:
        isVisible &&
        hasDistinctRange &&
        startDateKey < dateKey &&
        (isOpenEnded || (endDateKey != null && dateKey < endDateKey)),
      isRangeStart: isVisible && hasDistinctRange && isStart,
      isRangeEnd: isVisible && !isOpenEnded && hasDistinctRange && isEnd,
    };
  });
}
