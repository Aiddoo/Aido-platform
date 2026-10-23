import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV } from 'react-native-mmkv';

// 초안만 담는 인스턴스로 분리해 로그아웃 시 다른 설정을 건드리지 않고 한 번에 비운다.
const draftMMKV = createMMKV({ id: 'aido.drafts' });

export const mmkvDraftStorage: EnumerableSyncStorage = {
  getString: (key) => draftMMKV.getString(key),
  set: (key, value) => draftMMKV.set(key, value),
  delete: (key) => draftMMKV.remove(key),
  getAllKeys: () => draftMMKV.getAllKeys(),
  clearAll: () => draftMMKV.clearAll(),
};
