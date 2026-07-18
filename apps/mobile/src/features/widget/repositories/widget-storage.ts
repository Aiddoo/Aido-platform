import type { SyncStorage } from '@src/core/ports/sync-storage';
import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * 위젯 스냅샷 전용 MMKV 인스턴스 (지연 생성).
 *
 * 앱 기본 인스턴스와 분리해 headless task handler와의 동시 접근 표면을
 * 위젯 데이터로 한정한다 (MMKV는 프로세스 내 thread-safe).
 * iOS는 이 저장소를 쓰지 않으므로(expo-widgets가 App Group에 직접 저장)
 * 첫 접근 시점까지 네이티브 인스턴스 할당을 미룬다.
 */
let widgetMmkv: MMKV | null = null;

function instance(): MMKV {
  if (widgetMmkv === null) {
    widgetMmkv = createMMKV({ id: 'widget-storage' });
  }
  return widgetMmkv;
}

export const widgetSyncStorage: SyncStorage = {
  getString: (key) => instance().getString(key),
  set: (key, value) => instance().set(key, value),
  delete: (key) => instance().remove(key),
};
