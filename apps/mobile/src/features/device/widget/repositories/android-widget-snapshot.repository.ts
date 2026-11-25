import type { SyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import {
  type StoredWidgetSnapshot,
  widgetSnapshotStorageSchema,
} from '../schemas/widget-snapshot-storage.schema';

/** 키는 출시된 위젯 계약이다. snapshot은 v2 JSON, 소유자는 공유 snapshot 밖 별도 값이다 */
export const ANDROID_WIDGET_STORAGE_KEYS = {
  snapshot: 'aido_widget_snapshot_v1',
  snapshotUserId: 'aido_widget_snapshot_user_id_v1',
} as const;

export interface AndroidWidgetSnapshotRepository {
  findSnapshot(): StoredWidgetSnapshot | null;
  findUserId(): string | null;
  writeSnapshot(snapshot: StoredWidgetSnapshot, userId: string | null): void;
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
    // 사이에서 멈추면 새 계정 목록에 앞 주인이 남아 누른 명령만 다른 계정 것으로 지워진다(앞 계정 목록을 새 주인 것으로 읽지 않는다)
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
