import { getDateSectionKey } from '@src/shared/utils/date';
import { groupBy } from 'es-toolkit';

type DateSectionKey = ReturnType<typeof getDateSectionKey>;
export type DateSectionedListItem<TEntry> =
  | { type: 'header'; section: DateSectionKey }
  | { type: 'item'; entry: TEntry };

export function toDateSectionedListItems<TEntry extends { createdAt: Date }>(
  entries: readonly TEntry[],
  referenceDate: Date,
): DateSectionedListItem<TEntry>[] {
  const sections = groupBy(entries, (entry) => getDateSectionKey(entry.createdAt, referenceDate));
  return Object.values(sections).flatMap((sectionEntries): DateSectionedListItem<TEntry>[] => {
    const first = sectionEntries[0];
    if (first == null) {
      return [];
    }
    return [
      { type: 'header', section: getDateSectionKey(first.createdAt, referenceDate) },
      ...sectionEntries.map((entry) => ({ type: 'item' as const, entry })),
    ];
  });
}
