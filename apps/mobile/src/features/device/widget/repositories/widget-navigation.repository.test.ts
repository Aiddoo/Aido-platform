import { createMemoryObservableSyncStorage } from '@src/testing/core';

import type { WidgetNavigationCommand } from '../domains/widget-navigation.model';
import {
  createWidgetNavigationRepository,
  WIDGET_NAVIGATION_COMMAND_KEY,
} from './widget-navigation.repository';

const command: WidgetNavigationCommand = {
  id: 'first-tap',
  uri: 'aido://todo/12',
  userId: 'original-account',
  createdAt: 1000,
};

describe('위젯 탐색 명령 저장소', () => {
  it('headless 실행이 저장한 명령을 새 앱 인스턴스가 같은 값으로 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    createWidgetNavigationRepository(storage).save(command);
    const repository = createWidgetNavigationRepository(storage);

    // When
    const pending = repository.findPendingCommand();

    // Then
    expect(pending).toEqual(command);
    expect(repository.findPendingCommand()).toBe(pending);
  });

  it('이전 명령을 소비하는 동안 도착한 최신 명령은 삭제하지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createMemoryObservableSyncStorage());
    repository.save(command);
    const first = command;
    const latest = { ...command, id: 'latest-tap', uri: 'aido://todo/13' };
    repository.save(latest);

    // When
    const cleared = repository.clearIfCurrent(first);

    // Then
    expect(cleared).toBe(false);
    expect(repository.findPendingCommand()).toEqual(latest);
    expect(repository.clearIfCurrent(latest)).toBe(true);
    expect(repository.clearIfCurrent(latest)).toBe(false);
  });

  it('손상된 저장 값과 잘못된 URI는 명령으로 실행하지 않는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createWidgetNavigationRepository(storage);
    storage.set(WIDGET_NAVIGATION_COMMAND_KEY, '{broken');

    // When
    const before = repository.findPendingCommand();
    const cleared = repository.removeCorrupted();
    const saved = repository.save({ ...command, uri: 'https://example.com' });
    const after = repository.findPendingCommand();

    // Then
    expect(before).toBeNull();
    expect(cleared).toBe(true);
    expect(saved).toBe(false);
    expect(after).toBeNull();
  });

  it('늦게 도착한 오래된 터치가 아직 대기 중인 최신 터치를 덮지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createMemoryObservableSyncStorage());
    const latest = { ...command, id: 'latest-tap', createdAt: 2000 };
    repository.save(latest);

    // When
    const stored = repository.save(command);

    // Then
    expect(stored).toBe(false);
    expect(repository.findPendingCommand()).toEqual(latest);
  });

  it('구독을 해제한 화면에는 다음 위젯 명령을 알리지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe(listener);
    repository.save(command);

    // When
    unsubscribe();
    repository.save({ ...command, id: 'second-tap' });

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
