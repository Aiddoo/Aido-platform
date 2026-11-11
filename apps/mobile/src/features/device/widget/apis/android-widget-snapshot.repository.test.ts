import { createMemorySyncStorage } from '@src/testing/core';

import { createWidgetSnapshot } from '../__tests__/widget-snapshot.fixtures';
import { ANDROID_WIDGET_STORAGE_KEYS } from '../constants/widget.constants';
import { createAndroidWidgetSnapshotRepository } from './android-widget-snapshot.repository';

describe('Android 위젯 스냅샷 저장소', () => {
  it('같은 저장 키에 이미 저장된 v1 payload를 하루짜리 v2로 읽는다', () => {
    // Given
    // 1.12.x 앱이 남긴 v1 snapshot
    const storage = createMemorySyncStorage();
    const { days, updatedAtIso } = createWidgetSnapshot();
    storage.set(
      'aido_widget_snapshot_v1',
      JSON.stringify({ version: 1, updatedAtIso, ...days[0] }),
    );

    // When
    const repository = createAndroidWidgetSnapshotRepository(storage);

    // Then
    expect(repository.findSnapshot()).toEqual({ version: 2, updatedAtIso, days });
    expect(repository.findUserId()).toBeNull();
  });

  it('오늘과 내일을 담은 v2 snapshot을 같은 저장 키로 쓰고 그대로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const snapshot = createWidgetSnapshot({}, { state: 'empty', totalTodos: 0 });
    const repository = createAndroidWidgetSnapshotRepository(storage);

    // When
    repository.writeSnapshot(snapshot, 'current-user');

    // Then
    expect(storage.get('aido_widget_snapshot_v1')).toBe(JSON.stringify(snapshot));
    expect(repository.findSnapshot()).toEqual(snapshot);
  });

  it('로그아웃은 이전 계정 식별자를 지우고 공개 안내만 남긴다', () => {
    // Given
    const repository = createAndroidWidgetSnapshotRepository(createMemorySyncStorage());
    repository.writeSnapshot(createWidgetSnapshot(), 'previous-user');

    // When
    repository.writeSnapshot(createWidgetSnapshot({ state: 'loggedOut' }), 'previous-user');

    // Then
    expect(repository.findSnapshot()?.days[0].state).toBe('loggedOut');
    expect(repository.findUserId()).toBeNull();
  });

  it.each(['{broken', '{}', '{"version":2}'])('손상된 저장값 %s는 렌더하지 않는다', (raw) => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(ANDROID_WIDGET_STORAGE_KEYS.snapshot, raw);

    // When
    const snapshot = createAndroidWidgetSnapshotRepository(storage).findSnapshot();

    // Then
    expect(snapshot).toBeNull();
  });
});
