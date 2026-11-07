import type { SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, toNullableInstant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { EMPTY_ACTIVATION_PROGRESS } from '../constants/activation.constants';
import { persistedActivationProgressSchema } from '../schemas/activation-persisted.schema';
import type { ActivationIdentity, ActivationProgress } from '../schemas/activation.schema';

const KEY_PREFIX = 'aido_activation_v1';

interface ClaimActivationResult {
  isClaimed: boolean;
  progress: ActivationProgress;
}

export interface ActivationProgressRepository {
  get(identity: ActivationIdentity): ActivationProgress;
  markTodoCreated(identity: ActivationIdentity, at: Instant): ActivationProgress;
  claimActivated(identity: ActivationIdentity, at: Instant): ClaimActivationResult;
  unlockPushRegistration(identity: ActivationIdentity, at: Instant): ActivationProgress;
}

function createActivationProgressKey({ accountId, campaignId }: ActivationIdentity): string {
  return `${KEY_PREFIX}:${accountId}:${campaignId}`;
}

export function createActivationProgressRepository(
  storage: SyncStorage,
): ActivationProgressRepository {
  const get = (identity: ActivationIdentity): ActivationProgress => {
    const parsed = parseStoredJson(
      storage.get(createActivationProgressKey(identity)),
      persistedActivationProgressSchema,
    );
    if (parsed == null) {
      return { ...EMPTY_ACTIVATION_PROGRESS };
    }
    return {
      todoCreatedAt: toNullableInstant(parsed.todoCreatedAt),
      activatedAt: toNullableInstant(parsed.activatedAt),
      pushRegistrationUnlockedAt: toNullableInstant(parsed.pushRegistrationUnlockedAt),
    };
  };

  const save = (identity: ActivationIdentity, progress: ActivationProgress): boolean => {
    try {
      storage.set(createActivationProgressKey(identity), JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  };

  return {
    get,
    markTodoCreated: (identity, at) => {
      const current = get(identity);
      if (current.todoCreatedAt) {
        return current;
      }
      const next = { ...current, todoCreatedAt: at };
      return save(identity, next) ? next : current;
    },
    claimActivated: (identity, at) => {
      const current = get(identity);
      if (!current.todoCreatedAt || current.activatedAt) {
        return { isClaimed: false, progress: current };
      }

      const next = { ...current, activatedAt: at };
      return save(identity, next)
        ? { isClaimed: true, progress: next }
        : { isClaimed: false, progress: current };
    },
    unlockPushRegistration: (identity, at) => {
      const current = get(identity);
      if (current.pushRegistrationUnlockedAt) {
        return current;
      }
      const next = { ...current, pushRegistrationUnlockedAt: at };
      return save(identity, next) ? next : current;
    },
  };
}
