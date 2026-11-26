import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

const pendingStorageCleanupSchema = z.object({
  /** 조회 캐시 인스턴스를 통째로 지운다. 세션이 어떻게 끝났든 남는다 */
  queryCache: z.boolean(),
  /** 초안 인스턴스(초안·말로 메모 초안·계정 범위 저장 값)를 통째로 지운다. 로그아웃만 남긴다 */
  drafts: z.boolean(),
});
export type PendingStorageCleanup = z.infer<typeof pendingStorageCleanupSchema>;

/** 암호화 저장소를 열지 못한 실행은 끝난 세션의 조회 캐시·초안을 지울 수 없어 다음에 열 때 복원 전에 지운다 */
export const pendingStorageCleanupStoredValue = defineStoredValue({
  key: 'aido_session_pending_storage_cleanup_v1',
  schema: storedJsonSchema(pendingStorageCleanupSchema),
  fallback: null,
});
