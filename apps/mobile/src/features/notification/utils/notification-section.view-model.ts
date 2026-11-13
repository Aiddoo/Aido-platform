import {
  addDaysToDateKey,
  getCalendarWeek,
  isSameMonthDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { type Instant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { groupBy } from 'es-toolkit';

export type DateSectionKey = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier';

/** 목록 날짜 섹션. 두 날짜 key를 그대로 비교하며 주는 앱 달력 주(일요일 시작)다. */
export function getDateSectionKey(dateKey: DateKey, todayDateKey: DateKey): DateSectionKey {
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

export type DateSectionedListItem<TEntry> =
  | { type: 'header'; section: DateSectionKey }
  | { type: 'item'; entry: TEntry };

export function toDateSectionedListItems<TEntry extends { createdAt: Instant }>(
  entries: readonly TEntry[],
  todayDateKey: DateKey,
  timeZone: string,
): DateSectionedListItem<TEntry>[] {
  const getSection = (entry: TEntry) =>
    getDateSectionKey(toDateKey(entry.createdAt, timeZone), todayDateKey);
  const sections = groupBy(entries, getSection);
  return Object.values(sections).flatMap((sectionEntries): DateSectionedListItem<TEntry>[] => {
    const first = sectionEntries[0];
    if (first == null) {
      return [];
    }
    return [
      { type: 'header', section: getSection(first) },
      ...sectionEntries.map((entry) => ({ type: 'item' as const, entry })),
    ];
  });
}
