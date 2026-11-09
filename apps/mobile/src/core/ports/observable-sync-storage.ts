import type { SyncStorage } from '@src/core/ports/sync-storage';

/** 키별 변경 알림을 주는 동기 저장소. 앱과 위젯 headless 실행이 같은 값을 보는 데 쓴다. */
export interface ObservableSyncStorage extends SyncStorage {
  subscribe(key: string, listener: () => void): () => void;
}
