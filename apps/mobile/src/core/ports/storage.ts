import type { z } from 'zod';

/**
 * 키-값 저장소 포트.
 *
 * @throws {import('@src/shared/errors').KeychainLockedError}
 *   `get`은 기기 잠금 등으로 **지금 읽을 수 없을 때** 던진다. `null`(값 없음)과 구분된다.
 *   그 외 읽기 실패는 원본 오류를 그대로 던진다.
 *   저장된 값이 schema와 맞지 않으면 값이 없는 것(`null`)으로 본다.
 */
export interface Storage {
  get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
