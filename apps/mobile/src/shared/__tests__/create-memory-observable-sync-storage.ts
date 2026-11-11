import type { DIContainer } from '@src/bootstrap/providers/di-context';

export type MemoryObservableSyncStorage = DIContainer['syncStorage'] & {
  /** 모든 키에 남은 구독 수. 정리됐는지 확인할 때 쓴다 */
  getListenerCount(): number;
};

/** 어댑터(`device-sync-storage`)처럼 구독한 키가 바뀔 때만 그 구독자에게 알리고 키 목록도 주는 메모리 저장소 */
export function createMemoryObservableSyncStorage(): MemoryObservableSyncStorage {
  const values = new Map<string, string>();
  const listenersByKey = new Map<string, Set<() => void>>();

  const notify = (key: string) => {
    for (const listener of Array.from(listenersByKey.get(key) ?? [])) {
      listener();
    }
  };

  return {
    get: (key) => values.get(key),
    keys: () => [...values.keys()],
    set: (key, value) => {
      values.set(key, value);
      notify(key);
    },
    remove: (key) => {
      values.delete(key);
      notify(key);
    },
    subscribe: (key, listener) => {
      const listeners = listenersByKey.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByKey.set(key, listeners);
      return () => {
        listeners.delete(listener);
      };
    },
    getListenerCount: () =>
      Array.from(listenersByKey.values()).reduce((count, listeners) => count + listeners.size, 0),
  };
}
