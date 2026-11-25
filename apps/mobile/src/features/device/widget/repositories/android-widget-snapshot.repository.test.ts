import { createMemorySyncStorage } from '@src/testing/core';

import { createWidgetSnapshot } from '../__tests__/widget-snapshot.fixtures';
import {
  ANDROID_WIDGET_STORAGE_KEYS,
  createAndroidWidgetSnapshotRepository,
} from './android-widget-snapshot.repository';

describe('Android 위젯 스냅샷 저장소', () => {
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

  it('주인을 쓰기 전에 멈추면 새 계정 목록에 앞 주인이 남고 앞 계정 목록을 새 주인 것으로 읽지 않는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createAndroidWidgetSnapshotRepository(storage);
    repository.writeSnapshot(
      createWidgetSnapshot({
        topTodos: [{ id: 7, title: '앞 계정', completed: false, categoryColor: '#FFB3B3' }],
      }),
      'previous-user',
    );
    const ownerWriteFails = {
      ...storage,
      set: (key: string, value: string) => {
        if (key === ANDROID_WIDGET_STORAGE_KEYS.snapshotUserId) {
          throw new Error('process killed');
        }
        storage.set(key, value);
      },
    };
    const nextSnapshot = createWidgetSnapshot({
      topTodos: [{ id: 8, title: '새 계정', completed: false, categoryColor: '#FFB3B3' }],
    });

    // When
    const write = () =>
      createAndroidWidgetSnapshotRepository(ownerWriteFails).writeSnapshot(
        nextSnapshot,
        'next-user',
      );

    // Then
    expect(write).toThrow('process killed');
    expect(repository.findSnapshot()?.days[0].topTodos.map(({ title }) => title)).toEqual([
      '새 계정',
    ]);
    expect(repository.findUserId()).toBe('previous-user');
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
