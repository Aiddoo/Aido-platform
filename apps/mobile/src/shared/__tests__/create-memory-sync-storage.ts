import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';

export const createMemorySyncStorage = (): EnumerableSyncStorage => {
  const values = new Map<string, string>();

  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    delete: (key) => {
      values.delete(key);
    },
    getAllKeys: () => [...values.keys()],
    clearAll: () => values.clear(),
  };
};
