import type { SyncStorage } from '@src/core/ports/sync-storage';
import { MMKV } from 'react-native-mmkv';

/**
 * 위젯 스냅샷 전용 MMKV 인스턴스.
 *
 * 앱 기본 인스턴스와 분리해 headless task handler와의 동시 접근 표면을
 * 위젯 데이터로 한정한다 (MMKV는 프로세스 내 thread-safe).
 */
const widgetMmkv = new MMKV({ id: 'widget-storage' });

export const widgetSyncStorage: SyncStorage = {
  getString: (key) => widgetMmkv.getString(key),
  set: (key, value) => widgetMmkv.set(key, value),
  delete: (key) => widgetMmkv.delete(key),
};
