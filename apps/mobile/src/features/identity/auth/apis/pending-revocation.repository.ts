import type { Storage } from '@src/core/ports/storage';

import {
  type PendingRevocation,
  pendingRevocationSchema,
} from '../schemas/pending-revocation.schema';

// 영속 계약: 출시된 설치의 키체인 항목을 가리킨다
const PENDING_REVOCATION_KEY = 'pendingRevocation';

export interface PendingRevocationRepository {
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
