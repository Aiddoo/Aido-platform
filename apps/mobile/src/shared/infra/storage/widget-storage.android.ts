import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { createMMKV, type MMKV } from 'react-native-mmkv';

let mmkv: MMKV | null = null;

function getMmkv() {
  return (mmkv ??= createMMKV({ id: 'widget-storage' }));
}

export const widgetStorage: ObservableSyncStorage = {
  get: (key) => getMmkv().getString(key),
  set: (key, value) => getMmkv().set(key, value),
  remove: (key) => getMmkv().remove(key),
  subscribe: (key, listener) => {
    const subscription = getMmkv().addOnValueChangedListener((changedKey) => {
      if (changedKey === key) {
        listener();
      }
    });
    return () => subscription.remove();
  },
};
