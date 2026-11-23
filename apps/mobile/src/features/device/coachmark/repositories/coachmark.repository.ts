import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';

import { COACHMARK_KEY_PREFIX } from '../schemas/coachmark-storage.schema';

/** 더는 쓰지 않아 지우는 안내. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 */
const RETIRED_COACHMARK_KINDS: ReadonlySet<string> = new Set(['ai-consent-notice']);

export interface CoachmarkRepository {
  removeRetiredKeys(): void;
  clear(accountId: string): void;
}

export function createCoachmarkRepository(
  storage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): CoachmarkRepository {
  return {
    removeRetiredKeys: () => {
      const retiredKeys = storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${COACHMARK_KEY_PREFIX}:`) &&
            RETIRED_COACHMARK_KINDS.has(key.slice(key.lastIndexOf(':') + 1)),
        );
      for (const key of retiredKeys) {
        storage.remove(key);
      }
    },
    clear: (accountId) => {
      const accountKeys = storage
        .keys()
        .filter((key) => key.startsWith(`${COACHMARK_KEY_PREFIX}:${accountId}:`));
      for (const key of accountKeys) {
        storage.remove(key);
      }
    },
  };
}
