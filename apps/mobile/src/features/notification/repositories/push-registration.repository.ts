import type { Storage } from '@src/core/ports/storage';

import {
  createEmptyPushRegistration,
  type PushRegistration,
} from '../domains/push-registration.model';
import { pushRegistrationStorageSchema } from '../schemas/push-registration-storage.schema';

const PUSH_REGISTRATION_KEY = 'pushRegistration';

export interface PushRegistrationRepository {
  /** @throws 키체인 접근 실패 시 */
  find(): Promise<PushRegistration>;
  save(registration: PushRegistration): Promise<void>;
}

export function createPushRegistrationRepository(storage: Storage): PushRegistrationRepository {
  return {
    find: async () =>
      (await storage.get(PUSH_REGISTRATION_KEY, pushRegistrationStorageSchema)) ??
      createEmptyPushRegistration(),
    save: (registration) => storage.set(PUSH_REGISTRATION_KEY, registration),
  };
}
