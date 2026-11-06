import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';

export const createMemorySyncStorage = (): EnumerableSyncStorage => {
  const values = new Map<string, string>();

  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
    keys: () => [...values.keys()],
    clear: () => {
      values.clear();
    },
  };
};
