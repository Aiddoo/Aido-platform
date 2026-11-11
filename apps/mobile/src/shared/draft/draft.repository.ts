import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { type DraftEntry, draftEntrySchema } from './draft.model';

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const KEY_PREFIX = 'aido_draft_v1:';

export interface DraftRepository {
  find(id: string): DraftEntry | null;
  save(id: string, entry: DraftEntry): void;
  remove(id: string): void;
  findAllIds(): string[];
  removeAll(): void;
}

export function createDraftRepository(storage: EnumerableSyncStorage): DraftRepository {
  return {
    find: (id) => parseStoredJson(storage.get(`${KEY_PREFIX}${id}`), draftEntrySchema),
    save: (id, entry) => storage.set(`${KEY_PREFIX}${id}`, JSON.stringify(entry)),
    remove: (id) => storage.remove(`${KEY_PREFIX}${id}`),
    findAllIds: () =>
      storage
        .keys()
        .filter((key) => key.startsWith(KEY_PREFIX))
        .map((key) => key.slice(KEY_PREFIX.length)),
    removeAll: () => storage.clear(),
  };
}
