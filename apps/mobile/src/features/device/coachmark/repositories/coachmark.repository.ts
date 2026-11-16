import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';

import { COACHMARK_KEY_PREFIX } from '../schemas/coachmark-storage.schema';

/** 더는 쓰지 않아 지우는 안내. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 */
const RETIRED_COACHMARK_KINDS: readonly string[] = ['ai-consent-notice'];

export interface CoachmarkRepository {
  removeRetiredKeys(): void;
  clear(accountId: string): void;
}

export function createCoachmarkRepository(
  storage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): CoachmarkRepository {
  return {
    removeRetiredKeys: () => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${COACHMARK_KEY_PREFIX}:`) &&
            RETIRED_COACHMARK_KINDS.includes(key.slice(key.lastIndexOf(':') + 1)),
        )
        .forEach((key) => storage.remove(key));
    },
    clear: (accountId) => {
      storage
        .keys()
        .filter((key) => key.startsWith(`${COACHMARK_KEY_PREFIX}:${accountId}:`))
        .forEach((key) => storage.remove(key));
    },
  };
}
