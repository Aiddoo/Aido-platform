import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';

/** 1.15.0 이하가 계정·캠페인별로 쓰던 키. 진행은 서버 할 일 기록으로도 다시 채워져 옮기지 않고 지운다 */
const RETIRED_KEY_PREFIX = 'aido_activation_v1';

export interface ActivationProgressRepository {
  removeRetiredKeys(): void;
}

export function createActivationProgressRepository(
  storage: Pick<SyncStorage, 'remove'> & Pick<EnumerableSyncStorage, 'keys'>,
): ActivationProgressRepository {
  return {
    removeRetiredKeys: () => {
      storage
        .keys()
        .filter((key) => key.startsWith(`${RETIRED_KEY_PREFIX}:`))
        .forEach((key) => storage.remove(key));
    },
  };
}
