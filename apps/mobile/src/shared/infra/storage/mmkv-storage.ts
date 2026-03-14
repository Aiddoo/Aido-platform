import type { SyncStorage } from '@src/core/ports/sync-storage';
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV();

export const mmkvSyncStorage: SyncStorage = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  delete: (key) => mmkv.delete(key),
};
