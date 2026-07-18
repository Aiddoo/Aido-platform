import type { SyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV } from 'react-native-mmkv';

// v4: `new MMKV()` → `createMMKV()`. 무인자는 기본 id 'mmkv.default' + 기본 경로를 그대로
// 써서 v3 데이터를 이어받는다. `.delete()` → `.remove()`.
const mmkv = createMMKV();

export const mmkvSyncStorage: SyncStorage = {
  getString: (key) => mmkv.getString(key),
  set: (key, value) => mmkv.set(key, value),
  delete: (key) => mmkv.remove(key),
};
