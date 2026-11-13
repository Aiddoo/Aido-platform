import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { z } from 'zod';

/**
 * 키체인 대신 쓰는 메모리 저장소. 실제 어댑터처럼 JSON으로 왕복하고 schema에 안 맞으면 없는 값이다.
 * 실패나 정해진 값을 재현할 때만 `storage.get.mockRejectedValue`처럼 메서드를 덮어쓴다.
 */
export function createMemoryKeyValueStorage(): jest.Mocked<KeyValueStorage> {
  const values = new Map<string, string>();

  return {
    // 제네릭 메서드라 jest.fn의 추론 타입이 맞지 않아 구현은 mockImplementation으로 붙인다
    get: jest.fn().mockImplementation(async (key: string, schema: z.ZodType) => {
      const item = values.get(key);
      if (item == null) {
        return null;
      }
      const parsed = schema.safeParse(JSON.parse(item));
      return parsed.success ? parsed.data : null;
    }),
    set: jest.fn(async (key, value) => {
      values.set(key, JSON.stringify(value));
    }),
    remove: jest.fn(async (key) => {
      values.delete(key);
    }),
  };
}
