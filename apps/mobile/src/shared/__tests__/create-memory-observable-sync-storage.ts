import { createMemorySyncStorage, type MemorySyncStorage } from './create-memory-sync-storage';

export type MemoryObservableSyncStorage = MemorySyncStorage;

/** 앱과 위젯이 함께 읽는 기기 저장소(`device-sync-storage`) 자리의 fake. `createMemorySyncStorage`와 같은 구현이다 */
export function createMemoryObservableSyncStorage(): MemoryObservableSyncStorage {
  return createMemorySyncStorage();
}
