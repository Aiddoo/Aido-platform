import type { ImportCollectionRecord } from '@src/core/ports/todo-import-source';

import type { ImportCollection } from '../domains/todo-import-collection.model';

/** 캘린더마다 고른 기간의 가져올 일정 수를 붙인다. 일정이 없으면 0이다 */
export function toImportCollection(
  record: ImportCollectionRecord,
  itemCountByCollection: Readonly<Record<string, number>>,
): ImportCollection {
  return { ...record, itemCount: itemCountByCollection[record.collectionKey] ?? 0 };
}
