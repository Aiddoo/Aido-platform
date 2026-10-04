import type { WidgetNavigationStorage } from '../bridge/widget-navigation-storage';
import type { WidgetNavigationCommand } from '../models/widget-navigation.model';
import {
  createWidgetNavigationRepository,
  WIDGET_NAVIGATION_COMMAND_KEY,
} from './widget-navigation.repository';

function createStorage(): WidgetNavigationStorage {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      listeners.forEach((listener) => listener());
    },
    delete: (key) => {
      values.delete(key);
      listeners.forEach((listener) => listener());
    },
    subscribe: (_key, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const command: WidgetNavigationCommand = {
  id: 'first-tap',
  uri: 'aido://todo/12',
  userId: 'original-account',
  createdAt: 1000,
};

describe('위젯 탐색 명령 저장소', () => {
  it('headless 실행이 저장한 명령을 새 앱 인스턴스가 같은 값으로 읽는다', () => {
    // Given
    const storage = createStorage();
    createWidgetNavigationRepository(storage).store(command);
    const repository = createWidgetNavigationRepository(storage);

    // When
    const pending = repository.getPendingCommand();

    // Then
    expect(pending).toEqual(command);
    expect(repository.getPendingCommand()).toBe(pending);
  });

  it('이전 명령을 소비하는 동안 도착한 최신 명령은 삭제하지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createStorage());
    repository.store(command);
    const first = repository.getPendingCommand();
    const latest = { ...command, id: 'latest-tap', uri: 'aido://todo/13' };
    repository.store(latest);

    // When
    const cleared = repository.clearIfCurrent(first);

    // Then
    expect(cleared).toBe(false);
    expect(repository.getPendingCommand()).toEqual(latest);
    expect(repository.clearIfCurrent(latest)).toBe(true);
    expect(repository.clearIfCurrent(latest)).toBe(false);
  });

  it('손상된 저장 값과 잘못된 URI는 명령으로 실행하지 않는다', () => {
    // Given
    const storage = createStorage();
    const repository = createWidgetNavigationRepository(storage);
    storage.set(WIDGET_NAVIGATION_COMMAND_KEY, '{broken');

    // When / Then
    expect(repository.getPendingCommand()).toBeNull();
    expect(repository.clearIfCurrent(null)).toBe(true);
    expect(repository.store({ ...command, uri: 'https://example.com' })).toBe(false);
    expect(repository.getPendingCommand()).toBeNull();
  });

  it('늦게 도착한 오래된 터치가 아직 대기 중인 최신 터치를 덮지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createStorage());
    const latest = { ...command, id: 'latest-tap', createdAt: 2000 };
    repository.store(latest);

    // When
    const stored = repository.store(command);

    // Then
    expect(stored).toBe(false);
    expect(repository.getPendingCommand()).toEqual(latest);
  });

  it('구독을 해제한 화면에는 다음 위젯 명령을 알리지 않는다', () => {
    // Given
    const repository = createWidgetNavigationRepository(createStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe(listener);
    repository.store(command);

    // When
    unsubscribe();
    repository.store({ ...command, id: 'second-tap' });

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
