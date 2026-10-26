import type { SyncStorage } from '@src/core/ports/sync-storage';

import { buildWidgetSnapshot } from '../__tests__/widget-snapshot.factory';
import { ANDROID_WIDGET_STORAGE_KEYS } from '../bridge/android-widget';
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
  it('같은 저장 키에 이미 저장된 v1 payload를 하루짜리 v2로 읽는다', () => {
    // Given - 1.12.x 앱이 남긴 v1 snapshot
    const storage = createStorage();
    const { days, updatedAtIso } = buildWidgetSnapshot();
    storage.set(
      'aido_widget_snapshot_v1',
      JSON.stringify({ version: 1, updatedAtIso, ...days[0] }),
    );

    // When
    const repository = createAndroidWidgetSnapshotRepository(storage);

    // Then
    expect(repository.getSnapshot()).toEqual({ version: 2, updatedAtIso, days });
    expect(repository.getUserId()).toBeNull();
  });

  it('오늘과 내일을 담은 v2 snapshot을 같은 저장 키로 쓰고 그대로 읽는다', () => {
    // Given
    const storage = createStorage();
    const snapshot = buildWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const repository = createAndroidWidgetSnapshotRepository(storage);

    // When
    repository.writeSnapshot(snapshot, 'current-user');

    // Then
    expect(storage.getString('aido_widget_snapshot_v1')).toBe(JSON.stringify(snapshot));
    expect(repository.getSnapshot()).toEqual(snapshot);
  });

  it('로그아웃은 이전 계정 식별자를 지우고 공개 안내만 남긴다', () => {
    // Given
    const repository = createAndroidWidgetSnapshotRepository(createStorage());
    repository.writeSnapshot(buildWidgetSnapshot(), 'previous-user');

    // When
    repository.writeSnapshot(buildWidgetSnapshot({ state: 'loggedOut' }), 'previous-user');

    // Then
    expect(repository.getSnapshot()?.days[0].state).toBe('loggedOut');
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
