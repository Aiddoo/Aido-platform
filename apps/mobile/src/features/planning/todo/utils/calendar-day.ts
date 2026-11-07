import { isDateToday, isSaturday, isSunday } from '@src/features/planning/todo/utils/calendar-date';
import type { TextTone } from '@src/shared/ui';

export type CalendarDayType = 'selected' | 'today' | 'sunday' | 'saturday' | 'default';

interface CalendarDayInput {
  date: Date;
  isSelected: boolean;
  /** 렌더 중 new Date()를 만들지 않도록 useToday()의 오늘을 받는다. */
  today: Date;
  timeZone: string;
}

export function getDatePickerDayStyle({
  date,
  isSelected,
  today,
  timeZone,
}: CalendarDayInput): CalendarDayType {
  if (isSelected) {
    return 'selected';
  }
  if (isDateToday(date, today, timeZone)) {
    return 'today';
  }
  if (isSunday(date, timeZone)) {
    return 'sunday';
  }
  if (isSaturday(date, timeZone)) {
    return 'saturday';
  }
  return 'default';
}

export function getMonthViewDayStyle({
  date,
  isSelected,
  today,
  timeZone,
}: CalendarDayInput): CalendarDayType {
  if (isSelected) {
    return 'selected';
  }
  if (isSunday(date, timeZone)) {
    return 'sunday';
  }
  if (isSaturday(date, timeZone)) {
    return 'saturday';
  }
  if (isDateToday(date, today, timeZone)) {
    return 'today';
  }
  return 'default';
}

export function isTodayHighlighted({ date, isSelected, today, timeZone }: CalendarDayInput) {
  return !isSelected && isDateToday(date, today, timeZone);
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
