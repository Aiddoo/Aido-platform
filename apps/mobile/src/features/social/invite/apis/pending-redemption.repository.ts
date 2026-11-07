import type { SyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import {
  type PendingRedemption,
  pendingRedemptionSchema,
} from '../schemas/invite-redemption.schema';

const PENDING_REDEMPTION_KEY = 'aido_invite_pending_v1';

export interface PendingRedemptionRepository {
  find(): PendingRedemption | null;
  save(pending: PendingRedemption): void;
  clear(): void;
}

/** 로그인 전에 연 초대를 로그인 뒤 이어서 열 수 있게 기기에 잠깐 남겨 둔다 */
export function createPendingRedemptionRepository(
  storage: SyncStorage,
): PendingRedemptionRepository {
  return {
    // 손상된 값은 초대가 없는 것으로 본다
    find: () => parseStoredJson(storage.get(PENDING_REDEMPTION_KEY), pendingRedemptionSchema),
    save: (pending) => {
      try {
        storage.set(PENDING_REDEMPTION_KEY, JSON.stringify(pending));
      } catch {
        // 이어서 열지 못할 뿐 가입을 막지 않는다
      }
    },
    clear: () => {
      storage.remove(PENDING_REDEMPTION_KEY);
    },
  };
}
