import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';

/**
 * 메모리에 저장하는 동기 저장소 fake. 실패나 정해진 값을 재현할 때만
 * `storage.get.mockReturnValue`처럼 메서드를 덮어쓴다.
 */
export function createMemorySyncStorage(): jest.Mocked<EnumerableSyncStorage> {
  const values = new Map<string, string>();

  return {
    get: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    remove: jest.fn((key: string) => {
      values.delete(key);
    }),
    keys: jest.fn(() => [...values.keys()]),
    clear: jest.fn(() => {
      values.clear();
    }),
  };
}
