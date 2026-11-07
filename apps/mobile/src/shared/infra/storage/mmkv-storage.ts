import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV, useMMKVString } from 'react-native-mmkv';

// 무인자는 기본 id 'mmkv.default'와 기본 경로를 그대로 써서 v3 데이터를 이어받는다.
const mmkv = createMMKV();

export const mmkvSyncStorage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'> = {
  get: (key) => mmkv.getString(key),
  keys: () => mmkv.getAllKeys(),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.remove(key),
};

/** 저장소 값을 구독한다. 라이브러리 훅이라 인스턴스를 숨기는 경계로 둔다 */
export function useStoredString(key: string) {
  return useMMKVString(key, mmkv);
}
