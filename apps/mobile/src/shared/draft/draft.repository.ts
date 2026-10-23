import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';

import { type DraftEntry, draftEntrySchema } from './draft.model';

const KEY_PREFIX = 'aido_draft_v1:';

export interface DraftRepository {
  find(id: string): DraftEntry | undefined;
  save(id: string, entry: DraftEntry): void;
  remove(id: string): void;
  findAllIds(): string[];
  removeAll(): void;
}

function parseDraftEntry(raw: string | undefined): DraftEntry | undefined {
  if (raw === undefined) {
    return undefined;
  }

  try {
    const parsed = draftEntrySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function createDraftRepository(storage: EnumerableSyncStorage): DraftRepository {
  return {
    find: (id) => parseDraftEntry(storage.getString(`${KEY_PREFIX}${id}`)),
    save: (id, entry) => storage.set(`${KEY_PREFIX}${id}`, JSON.stringify(entry)),
    remove: (id) => storage.delete(`${KEY_PREFIX}${id}`),
    findAllIds: () =>
      storage
        .getAllKeys()
        .filter((key) => key.startsWith(KEY_PREFIX))
        .map((key) => key.slice(KEY_PREFIX.length)),
    removeAll: () => storage.clearAll(),
  };
}
