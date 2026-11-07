import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';

/** 메모리에 두고 바뀔 때 구독자에게 알리는 위젯 이동 명령 저장소 */
export function createMemoryObservableSyncStorage(): ObservableSyncStorage {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      listeners.forEach((listener) => listener());
    },
    remove: (key) => {
      values.delete(key);
      listeners.forEach((listener) => listener());
    },
    subscribe: (_key, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
