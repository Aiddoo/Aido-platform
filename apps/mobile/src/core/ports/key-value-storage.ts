import type { z } from 'zod';

/** `get`은 기기 잠금 등으로 지금 읽을 수 없을 때 `KeychainLockedError`를 던진다(null=값 없음과 구분). 그 외 읽기 실패는 원본을 던지고, schema와 맞지 않는 값은 null로 본다 */
export interface KeyValueStorage {
  get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
