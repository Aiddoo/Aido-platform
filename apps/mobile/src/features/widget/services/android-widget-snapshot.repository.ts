import type { SyncStorage } from '@src/core/ports/sync-storage';

import { ANDROID_WIDGET_STORAGE_KEYS } from '../bridge/android-widget.constant';
import { widgetSnapshotSchema, type WidgetSnapshot } from '../models/widget-snapshot.model';

export function createAndroidWidgetSnapshotRepository(storage: SyncStorage) {
  return {
    getSnapshot(): WidgetSnapshot | null {
      const raw = storage.getString(ANDROID_WIDGET_STORAGE_KEYS.snapshot);
      if (raw == null) return null;

      try {
        const result = widgetSnapshotSchema.safeParse(JSON.parse(raw));
        return result.success ? result.data : null;
      } catch {
        return null;
      }
    },
    getUserId(): string | null {
      const userId = storage.getString(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId);
      return userId && userId.trim().length > 0 ? userId : null;
    },
    writeSnapshot(snapshot: WidgetSnapshot, userId: string | null): void {
      storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshot, JSON.stringify(snapshot));
      if (snapshot.state === 'loggedOut' || userId == null) {
        storage.delete(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId);
        return;
      }
      storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId, userId);
    },
  };
}

export type AndroidWidgetSnapshotRepository = ReturnType<
  typeof createAndroidWidgetSnapshotRepository
>;
