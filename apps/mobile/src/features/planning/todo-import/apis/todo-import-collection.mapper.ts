import type { ImportCollectionRecord } from '@src/core/ports/todo-import-source';

import type { ImportCollection } from '../domains/todo-import-collection.model';

export function toImportCollection(
  record: ImportCollectionRecord,
  itemCountByCollection: Readonly<Record<string, number>>,
): ImportCollection {
  return { ...record, itemCount: itemCountByCollection[record.collectionKey] ?? 0 };
}
