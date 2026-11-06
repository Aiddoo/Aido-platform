import type { SyncStorage } from '@src/core/ports/sync-storage';

/** 위젯 headless 실행과 앱이 공유하는 동기 저장소의 변경 알림 경계. */
export interface WidgetNavigationStorage extends SyncStorage {
  subscribe(key: string, listener: () => void): () => void;
}
