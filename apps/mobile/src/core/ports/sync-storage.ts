export interface SyncStorage {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface EnumerableSyncStorage extends SyncStorage {
  keys(): string[];
  clear(): void;
}
