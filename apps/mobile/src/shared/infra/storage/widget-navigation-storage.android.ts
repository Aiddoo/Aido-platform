import type { WidgetNavigationStorage } from '@src/core/ports/widget-navigation-storage';
import { createMMKV, type MMKV } from 'react-native-mmkv';

let widgetStorage: MMKV | null = null;

const getWidgetStorage = () => (widgetStorage ??= createMMKV({ id: 'widget-storage' }));

export const widgetNavigationStorage: WidgetNavigationStorage = {
  get: (key) => getWidgetStorage().getString(key),
  set: (key, value) => getWidgetStorage().set(key, value),
  remove: (key) => getWidgetStorage().remove(key),
  subscribe: (key, listener) => {
    const subscription = getWidgetStorage().addOnValueChangedListener((changedKey) => {
      if (changedKey === key) {
        listener();
      }
    });
    return () => subscription.remove();
  },
};
