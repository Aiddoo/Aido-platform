export interface SyncStorage {
  /** 값이 없으면 undefined다. MMKV `getString`의 계약을 그대로 따른다 */
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface EnumerableSyncStorage extends SyncStorage {
  keys(): string[];
  clear(): void;
}
