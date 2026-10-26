import type { EnumerableSyncStorage, ObservableSyncStorage } from '@src/core/ports/sync-storage';

export const createMemorySyncStorage = (): EnumerableSyncStorage & ObservableSyncStorage => {
  const values = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener());

  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      notify(key);
    },
    delete: (key) => {
      values.delete(key);
      notify(key);
    },
    getAllKeys: () => [...values.keys()],
    clearAll: () => {
      const keys = [...values.keys()];
      values.clear();
      keys.forEach(notify);
    },
    subscribe: (key, listener) => {
      const keyListeners = listeners.get(key) ?? new Set();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);
      return () => keyListeners.delete(listener);
    },
  };
};
