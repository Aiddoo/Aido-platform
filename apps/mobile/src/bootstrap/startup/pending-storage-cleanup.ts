import type { SyncStorage } from '@src/core/ports/sync-storage';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';

import {
  type PendingStorageCleanup,
  pendingStorageCleanupStoredValue,
} from '../schemas/pending-storage-cleanup-storage.schema';

/** 저장소를 열지 못한 실행에서 끝난 세션의 정리를 다음에 열 때로 미룬다. 앞선 표시와 합친다 */
export function markPendingStorageCleanup(
  storage: SyncStorage,
  target: keyof PendingStorageCleanup,
): void {
  const pending = readStoredValue(storage, pendingStorageCleanupStoredValue);
  writeStoredValue(storage, pendingStorageCleanupStoredValue, {
    queryCache: target === 'queryCache' || pending?.queryCache === true,
    drafts: target === 'drafts' || pending?.drafts === true,
  });
}
