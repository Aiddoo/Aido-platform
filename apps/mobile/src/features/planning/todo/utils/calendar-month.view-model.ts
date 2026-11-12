import {
  getDayOfMonth,
  getDayOfWeek,
  isSameMonthDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/date/format/date-format';

import { getMonthWeekStartKeys, getWeekDateKeys } from './calendar-grid.view-model';

/** 피드 달력 월 보기는 달마다 쪽 높이가 같도록 늘 6주를 그린다 */
export const FEED_MONTH_WEEK_COUNT = 6;

/** 달력 한 칸. 쪽(주·달)과 언어가 같으면 다시 만들지 않아, 칸은 Intl·날짜 계산 없이 그린다 */
export interface CalendarDayCell {
  dateKey: DateKey;
  dayNumber: string;
  /** 읽어 줄 날짜 */
  label: string;
  /** 0=일 … 6=토 */
  dayOfWeek: number;
  /** 보고 있는 달 밖의 칸. 주 보기는 늘 false다 */
  isOutsideMonth: boolean;
}

function toCalendarDayCell(
  dateKey: DateKey,
  monthKey: DateKey | null,
  context: DateFormatContext,
): CalendarDayCell {
  return {
    dateKey,
    dayNumber: String(getDayOfMonth(dateKey)),
    label: formatDateKeyLabel(dateKey, 'fullDate', context),
    dayOfWeek: getDayOfWeek(dateKey),
    isOutsideMonth: monthKey != null && !isSameMonthDateKey(dateKey, monthKey),
  };
}

function getMonthWeeks(
  monthKey: DateKey,
  minWeekCount: number,
  context: DateFormatContext,
): CalendarDayCell[][] {
  return getMonthWeekStartKeys(monthKey, minWeekCount).map((weekStartKey) =>
    getWeekDateKeys(weekStartKey).map((dateKey) => toCalendarDayCell(dateKey, monthKey, context)),
  );
}

/** 날짜·반복 피커의 한 달. 그 달이 걸친 주만 그리고, 달 밖 칸은 비워 둔다 */
export function getPickerMonthWeeks(
  monthKey: DateKey,
  context: DateFormatContext,
): CalendarDayCell[][] {
  return getMonthWeeks(monthKey, 0, context);
}

export function getFeedMonthWeeks(
  monthKey: DateKey,
  context: DateFormatContext,
): CalendarDayCell[][] {
  return getMonthWeeks(monthKey, FEED_MONTH_WEEK_COUNT, context);
}

export function getFeedWeekCells(
  weekStartKey: DateKey,
  context: DateFormatContext,
): CalendarDayCell[] {
  return getWeekDateKeys(weekStartKey).map((dateKey) => toCalendarDayCell(dateKey, null, context));
}
