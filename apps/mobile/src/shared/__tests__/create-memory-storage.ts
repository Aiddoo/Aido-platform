import type { Storage } from '@src/core/ports/storage';

/** 키체인 대신 쓰는 메모리 저장소. 실제 어댑터처럼 JSON으로 왕복하고 schema에 안 맞으면 없는 값이다 */
export function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get: async (key, schema) => {
      const item = values.get(key);
      if (item == null) {
        return null;
      }
      const parsed = schema.safeParse(JSON.parse(item));
      return parsed.success ? parsed.data : null;
    },
    set: async (key, value) => {
      values.set(key, JSON.stringify(value));
    },
    remove: async (key) => {
      values.delete(key);
    },
    clear: async () => {
      values.clear();
    },
  };
}
