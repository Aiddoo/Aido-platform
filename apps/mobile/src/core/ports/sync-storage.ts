export interface SyncStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export interface EnumerableSyncStorage extends SyncStorage {
  getAllKeys(): string[];
  clearAll(): void;
}

/** 값이 바뀔 때 알려 주는 저장소. 화면이 저장소 값을 직접 구독할 때 쓴다 */
export interface ObservableSyncStorage extends SyncStorage {
  /** key 값이 바뀌면 listener를 부른다. 반환값은 구독 해제 함수다 */
  subscribe(key: string, listener: () => void): () => void;
}
