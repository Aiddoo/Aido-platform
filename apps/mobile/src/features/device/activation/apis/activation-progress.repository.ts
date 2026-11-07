import type { SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, toInstant } from '@src/shared/date/instant';

import { persistedActivationProgressSchema } from '../schemas/activation-persisted.schema';
import type { ActivationIdentity, ActivationProgress } from '../schemas/activation.schema';

const KEY_PREFIX = 'aido_activation_v1';

const EMPTY_PROGRESS: ActivationProgress = {
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
};

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

function toNullableInstant(value: string | null) {
  return value == null ? null : toInstant(value);
}

function activationProgressKey({ accountId, campaignId }: ActivationIdentity): string {
  return `${KEY_PREFIX}:${accountId}:${campaignId}`;
}

export function createActivationProgressRepository(
  storage: SyncStorage,
): ActivationProgressRepository {
  const get = (identity: ActivationIdentity): ActivationProgress => {
    let decoded: unknown;
    try {
      const raw = storage.get(activationProgressKey(identity));
      if (!raw) {
        return { ...EMPTY_PROGRESS };
      }
      decoded = JSON.parse(raw);
    } catch {
      return { ...EMPTY_PROGRESS };
    }

    const parsed = persistedActivationProgressSchema.safeParse(decoded);
    if (!parsed.success) {
      return { ...EMPTY_PROGRESS };
    }
    return {
      todoCreatedAt: toNullableInstant(parsed.data.todoCreatedAt),
      activatedAt: toNullableInstant(parsed.data.activatedAt),
      pushRegistrationUnlockedAt: toNullableInstant(parsed.data.pushRegistrationUnlockedAt),
    };
  };

  const save = (identity: ActivationIdentity, progress: ActivationProgress): boolean => {
    try {
      storage.set(activationProgressKey(identity), JSON.stringify(progress));
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
