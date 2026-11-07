import type { SyncStorage } from '@src/core/ports/sync-storage';

import { celebratedCountSchema } from '../schemas/paw-print-celebration.schema';

const PAW_PRINT_CELEBRATION_KEY_PREFIX = 'aido_invite_paw_print_celebrated_v1';

export interface PawPrintCelebrationRepository {
  getCelebratedCount(userId: string): number;
  /** 줄어든 경우(보상 회수 등)에도 그 수로 맞춰 다음 발자국에서 다시 축하한다 */
  setCelebratedCount(userId: string, count: number): void;
}

/** 찍히는 애니메이션을 이미 본 발자국 수. 계정마다 따로 두어 같은 기기 다른 계정과 섞이지 않는다 */
export function createPawPrintCelebrationRepository(
  storage: SyncStorage,
): PawPrintCelebrationRepository {
  const toKey = (userId: string) => `${PAW_PRINT_CELEBRATION_KEY_PREFIX}:${userId}`;

  return {
    getCelebratedCount: (userId) => celebratedCountSchema.parse(storage.get(toKey(userId))),
    setCelebratedCount: (userId, count) => storage.set(toKey(userId), String(count)),
  };
}
