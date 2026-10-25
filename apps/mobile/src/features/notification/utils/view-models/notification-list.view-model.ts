import { getDateSectionKey, type DateSectionKey } from '@src/shared/utils/date';
import { formatDateKey } from '@src/shared/utils/date-format';
import { groupBy } from 'es-toolkit';

export type DateSectionedListItem<TEntry> =
  | { type: 'header'; section: DateSectionKey }
  | { type: 'item'; entry: TEntry };

export function toDateSectionedListItems<TEntry extends { createdAt: Date }>(
  entries: readonly TEntry[],
  todayDateKey: string,
  timeZone: string,
): DateSectionedListItem<TEntry>[] {
  const getSection = (entry: TEntry) =>
    getDateSectionKey(formatDateKey(entry.createdAt, timeZone), todayDateKey);
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
