import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';
import type { ActivationIdentity, ActivationProgress } from '../models/activation.model';

const KEY_PREFIX = 'aido_activation_v1';

const persistedActivationProgressSchema = z.object({
  todoCreatedAt: z.iso.datetime().nullable(),
  activatedAt: z.iso.datetime().nullable(),
  pushRegistrationUnlockedAt: z.iso.datetime().nullable().default(null),
});

const EMPTY_PROGRESS: ActivationProgress = {
  todoCreatedAt: null,
  activatedAt: null,
  pushRegistrationUnlockedAt: null,
};

interface ClaimActivationResult {
  claimed: boolean;
  progress: ActivationProgress;
}

export interface ActivationProgressRepository {
  get(identity: ActivationIdentity): ActivationProgress;
  markTodoCreated(identity: ActivationIdentity, at: Date): ActivationProgress;
  claimActivated(identity: ActivationIdentity, at: Date): ClaimActivationResult;
  unlockPushRegistration(identity: ActivationIdentity, at: Date): ActivationProgress;
}

const activationProgressKey = ({ accountId, campaignId }: ActivationIdentity): string =>
  `${KEY_PREFIX}:${accountId}:${campaignId}`;

function toPersisted(progress: ActivationProgress) {
  return {
    todoCreatedAt: progress.todoCreatedAt?.toISOString() ?? null,
    activatedAt: progress.activatedAt?.toISOString() ?? null,
    pushRegistrationUnlockedAt: progress.pushRegistrationUnlockedAt?.toISOString() ?? null,
  };
}

export function createActivationProgressRepository(
  storage: SyncStorage,
): ActivationProgressRepository {
  const get = (identity: ActivationIdentity): ActivationProgress => {
    let decoded: unknown;
    try {
      const raw = storage.getString(activationProgressKey(identity));
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
      todoCreatedAt: parsed.data.todoCreatedAt ? new Date(parsed.data.todoCreatedAt) : null,
      activatedAt: parsed.data.activatedAt ? new Date(parsed.data.activatedAt) : null,
      pushRegistrationUnlockedAt: parsed.data.pushRegistrationUnlockedAt
        ? new Date(parsed.data.pushRegistrationUnlockedAt)
        : null,
    };
  };

  const save = (identity: ActivationIdentity, progress: ActivationProgress): boolean => {
    try {
      storage.set(activationProgressKey(identity), JSON.stringify(toPersisted(progress)));
      return true;
    } catch {
      return false;
    }
  };

  return {
    get,
    markTodoCreated(identity, at) {
      const current = get(identity);
      if (current.todoCreatedAt) {
        return current;
      }
      const next = { ...current, todoCreatedAt: at };
      return save(identity, next) ? next : current;
    },
    claimActivated(identity, at) {
      const current = get(identity);
      if (!current.todoCreatedAt || current.activatedAt) {
        return { claimed: false, progress: current };
      }

      const next = { ...current, activatedAt: at };
      return save(identity, next)
        ? { claimed: true, progress: next }
        : { claimed: false, progress: current };
    },
    unlockPushRegistration(identity, at) {
      const current = get(identity);
      if (current.pushRegistrationUnlockedAt) {
        return current;
      }
      const next = { ...current, pushRegistrationUnlockedAt: at };
      return save(identity, next) ? next : current;
    },
  };
}
