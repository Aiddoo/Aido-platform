import type { Storage } from '@src/core/ports/storage';

import {
  type PendingRevocation,
  pendingRevocationSchema,
} from '../schemas/pending-revocation-storage.schema';

// ⚠️ 영속 계약: 출시된 설치의 키체인 항목을 가리킨다. 토큰 키와 분리해 세션 판정에 쓰이지 않는다
const PENDING_REVOCATION_KEY = 'pendingRevocation';

export interface PendingRevocationRepository {
  /** @throws 키체인 접근 실패 시 */
  find(): Promise<PendingRevocation | null>;
  save(pending: PendingRevocation): Promise<void>;
  clear(): Promise<void>;
}

export function createPendingRevocationRepository(storage: Storage): PendingRevocationRepository {
  return {
    find: () => storage.get(PENDING_REVOCATION_KEY, pendingRevocationSchema),
    save: (pending) => storage.set(PENDING_REVOCATION_KEY, pending),
    clear: () => storage.remove(PENDING_REVOCATION_KEY),
  };
}
