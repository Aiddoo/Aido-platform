import type { SyncStorage } from '@src/core/ports/sync-storage';

import {
  type PendingRedemption,
  PendingRedemptionSchema,
} from '../domains/invite-redemption.model';

const PENDING_REDEMPTION_KEY = 'aido_invite_pending_v1';

export interface PendingRedemptionRepository {
  get(): PendingRedemption | null;
  save(pending: PendingRedemption): void;
  clear(): void;
}

/** 로그인 전에 연 초대를 로그인 뒤 이어서 열 수 있게 기기에 잠깐 남겨 둔다 */
export function createPendingRedemptionRepository(
  storage: SyncStorage,
): PendingRedemptionRepository {
  return {
    get() {
      const raw = storage.getString(PENDING_REDEMPTION_KEY);
      if (raw == null) {
        return null;
      }

      try {
        const parsed = PendingRedemptionSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        // 손상된 값은 초대가 없는 것으로 본다
        return null;
      }
    },
    save(pending) {
      storage.set(PENDING_REDEMPTION_KEY, JSON.stringify(pending));
    },
    clear() {
      storage.delete(PENDING_REDEMPTION_KEY);
    },
  };
}
