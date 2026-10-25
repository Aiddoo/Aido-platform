import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

const PAW_PRINT_CELEBRATION_KEY_PREFIX = 'aido_invite_paw_print_celebrated_v1';

const CelebratedCountSchema = z.coerce.number().int().nonnegative().catch(0);

export interface PawPrintCelebrationRepository {
  getCelebratedCount(userId: string): number;
  setCelebratedCount(userId: string, count: number): void;
}

/** 찍히는 애니메이션을 이미 본 발자국 수. 계정마다 따로 두어 같은 기기 다른 계정과 섞이지 않는다 */
export function createPawPrintCelebrationRepository(
  storage: SyncStorage,
): PawPrintCelebrationRepository {
  const toKey = (userId: string) => `${PAW_PRINT_CELEBRATION_KEY_PREFIX}:${userId}`;

  return {
    getCelebratedCount: (userId) => CelebratedCountSchema.parse(storage.getString(toKey(userId))),
    setCelebratedCount: (userId, count) => storage.set(toKey(userId), String(count)),
  };
}
