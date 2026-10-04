import type { SyncStorage } from '@src/core/ports/sync-storage';

import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { ANDROID_WIDGET_STORAGE_KEYS } from '../bridge/android-widget.constant';
import { createAndroidWidgetSnapshotRepository } from './android-widget-snapshot.repository';

function createStorage(): SyncStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

describe('Android 위젯 스냅샷 저장소', () => {
  it('기존 v1 저장 키와 payload를 변경하지 않고 읽는다', () => {
    // Given
    const storage = createStorage();
    const snapshot = buildWidgetSnapshot();
    storage.set('aido_widget_snapshot_v1', JSON.stringify(snapshot));

    // When
    const repository = createAndroidWidgetSnapshotRepository(storage);

    // Then
    expect(repository.getSnapshot()).toEqual(snapshot);
    expect(repository.getUserId()).toBeNull();
  });

  it('로그아웃은 이전 계정 식별자를 지우고 공개 안내만 남긴다', () => {
    // Given
    const repository = createAndroidWidgetSnapshotRepository(createStorage());
    repository.writeSnapshot(buildWidgetSnapshot(), 'previous-user');

    // When
    repository.writeSnapshot(buildWidgetSnapshot({ state: 'loggedOut' }), 'previous-user');

    // Then
    expect(repository.getSnapshot()?.state).toBe('loggedOut');
    expect(repository.getUserId()).toBeNull();
  });

  it.each(['{broken', '{}', '{"version":2}'])('손상된 저장값 %s는 렌더하지 않는다', (raw) => {
    // Given
    const storage = createStorage();
    storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshot, raw);

    // When
    const snapshot = createAndroidWidgetSnapshotRepository(storage).getSnapshot();

    // Then
    expect(snapshot).toBeNull();
  });
});
