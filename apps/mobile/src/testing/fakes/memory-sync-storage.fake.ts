import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';

export type MemorySyncStorage = jest.Mocked<EnumerableSyncStorage & ObservableSyncStorage> & {
  /** 모든 키에 남은 구독 수. 정리됐는지 확인할 때 쓴다 */
  getListenerCount(): number;
};

/**
 * 메모리에 저장하는 동기 저장소 fake. 실패나 정해진 값을 재현할 때만
 * `storage.get.mockReturnValue`처럼 메서드를 덮어쓴다. 구독은 어댑터처럼 그 키가 바뀔 때만 알린다.
 */
export function createMemorySyncStorage(): MemorySyncStorage {
  const values = new Map<string, string>();
  const listenersByKey = new Map<string, Set<() => void>>();

  const notify = (key: string) => {
    for (const listener of Array.from(listenersByKey.get(key) ?? [])) {
      listener();
    }
  };

  return {
    get: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: string) => {
      values.set(key, value);
      notify(key);
    }),
    remove: jest.fn((key: string) => {
      values.delete(key);
      notify(key);
    }),
    keys: jest.fn(() => [...values.keys()]),
    clear: jest.fn(() => {
      const keys = [...values.keys()];
      values.clear();
      keys.forEach(notify);
    }),
    subscribe: jest.fn((key: string, listener: () => void) => {
      const listeners = listenersByKey.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByKey.set(key, listeners);
      return () => {
        listeners.delete(listener);
      };
    }),
    getListenerCount: () =>
      Array.from(listenersByKey.values()).reduce((count, listeners) => count + listeners.size, 0),
  };
}
