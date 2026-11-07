import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV } from 'react-native-mmkv';

// 무인자는 기본 id 'mmkv.default'와 기본 경로를 그대로 써서 v3 데이터를 이어받는다.
const mmkv = createMMKV();

export const deviceSyncStorage: ObservableSyncStorage & Pick<EnumerableSyncStorage, 'keys'> = {
  get: (key) => mmkv.getString(key),
  keys: () => mmkv.getAllKeys(),
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.remove(key),
  subscribe: (key, listener) => {
    const subscription = mmkv.addOnValueChangedListener((changedKey) => {
      if (changedKey === key) {
        listener();
      }
    });
    return () => subscription.remove();
  },
};
