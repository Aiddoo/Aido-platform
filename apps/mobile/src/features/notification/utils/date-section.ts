import { addDaysToDateKey, getCalendarWeek, isSameMonthDateKey } from '@src/shared/date/date-key';

export type DateSectionKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

/** 목록 날짜 섹션. 두 날짜 key를 그대로 비교하며 주는 앱 달력 주(일요일 시작)다. */
export function getDateSectionKey(dateKey: string, todayDateKey: string): DateSectionKey {
  if (dateKey === todayDateKey) {
    return 'today';
  }
  if (dateKey === addDaysToDateKey(todayDateKey, -1)) {
    return 'yesterday';
  }
  if (getCalendarWeek(dateKey).startDateKey === getCalendarWeek(todayDateKey).startDateKey) {
    return 'thisWeek';
  }
  if (isSameMonthDateKey(dateKey, todayDateKey)) {
    return 'thisMonth';
  }
  return 'earlier';
}
