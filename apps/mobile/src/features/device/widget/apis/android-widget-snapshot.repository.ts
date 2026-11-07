import type { SyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { ANDROID_WIDGET_STORAGE_KEYS } from '../constants/widget.constants';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import { storedWidgetSnapshotSchema } from '../schemas/widget-snapshot-persisted.schema';
import type { WidgetSnapshot } from '../schemas/widget-snapshot.schema';

export interface AndroidWidgetSnapshotRepository {
  getSnapshot(): WidgetSnapshot | null;
  getUserId(): string | null;
  writeSnapshot(snapshot: WidgetSnapshot, userId: string | null): void;
}

export function createAndroidWidgetSnapshotRepository(
  storage: SyncStorage,
): AndroidWidgetSnapshotRepository {
  return {
    getSnapshot: () =>
      parseStoredJson(
        storage.get(ANDROID_WIDGET_STORAGE_KEYS.snapshot),
        storedWidgetSnapshotSchema,
      ),
    getUserId: () => {
      const userId = storage.get(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId);
      return userId && userId.trim().length > 0 ? userId : null;
    },
    writeSnapshot: (snapshot, userId) => {
      storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshot, JSON.stringify(snapshot));
      if (WidgetSnapshotPolicy.isLoggedOut(snapshot) || userId == null) {
        storage.remove(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId);
        return;
      }
      storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId, userId);
    },
  };
}
