import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV } from 'react-native-mmkv';

// DI보다 먼저 그리는 설정 Provider·i18n/init이 읽어 모듈 값이다. 무인자는 기본 id·경로라 v3 데이터를 이어받는다
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
