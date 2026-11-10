import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { Instant } from '@src/shared/date/instant';

import { pushDeviceReleaseRequestedAtStorageSchema } from '../schemas/push-device-release-storage.schema';

const RELEASE_REQUESTED_AT_KEY = 'aido_push_device_release_requested_at_v1';

/** 아직 서버에 보내지 못한 끝난 세션의 기기 해제. 앱을 다시 켜도 이어서 보내도록 기기에 남긴다 */
export interface PushDeviceReleaseRepository {
  hasPending(): boolean;
  save(requestedAt: Instant): void;
  clear(): void;
}

export function createPushDeviceReleaseRepository(
  storage: SyncStorage,
): PushDeviceReleaseRepository {
  return {
    hasPending: () =>
      pushDeviceReleaseRequestedAtStorageSchema.parse(
        storage.get(RELEASE_REQUESTED_AT_KEY) ?? null,
      ) != null,
    save: (requestedAt) => storage.set(RELEASE_REQUESTED_AT_KEY, requestedAt),
    clear: () => storage.remove(RELEASE_REQUESTED_AT_KEY),
  };
}
