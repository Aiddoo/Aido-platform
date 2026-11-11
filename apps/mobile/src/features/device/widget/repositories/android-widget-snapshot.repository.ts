import type { SyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import {
  type WidgetSnapshot,
  widgetSnapshotStorageSchema,
} from '../schemas/widget-snapshot-storage.schema';

/** 키는 출시된 위젯 계약이다. snapshot은 v2 JSON, 소유자는 공유 snapshot 밖 별도 값이다 */
export const ANDROID_WIDGET_STORAGE_KEYS = {
  snapshot: 'aido_widget_snapshot_v1',
  snapshotUserId: 'aido_widget_snapshot_user_id_v1',
} as const;

export interface AndroidWidgetSnapshotRepository {
  findSnapshot(): WidgetSnapshot | null;
  findUserId(): string | null;
  writeSnapshot(snapshot: WidgetSnapshot, userId: string | null): void;
}

export function createAndroidWidgetSnapshotRepository(
  storage: SyncStorage,
): AndroidWidgetSnapshotRepository {
  return {
    findSnapshot: () =>
      parseStoredJson(
        storage.get(ANDROID_WIDGET_STORAGE_KEYS.snapshot),
        widgetSnapshotStorageSchema,
      ),
    findUserId: () => {
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
