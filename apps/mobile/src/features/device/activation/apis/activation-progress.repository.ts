import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { type Instant, toNullableInstant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { EMPTY_ACTIVATION_PROGRESS } from '../constants/activation.constants';
import type { ActivationIdentity, ActivationProgress } from '../domains/activation.model';
import {
  type PersistedActivationProgress,
  persistedActivationProgressSchema,
} from '../schemas/activation-persisted.schema';

const KEY_PREFIX = 'aido_activation_v1';

interface ClaimActivationResult {
  isClaimed: boolean;
  progress: ActivationProgress;
}

export interface ActivationProgressRepository {
  /** 저장값이 그대로면 같은 객체를 돌려준다(`useSyncExternalStore`의 스냅샷) */
  get(identity: ActivationIdentity): ActivationProgress;
  subscribe(identity: ActivationIdentity, listener: () => void): () => void;
  markTodoCreated(identity: ActivationIdentity, at: Instant): ActivationProgress;
  claimActivated(identity: ActivationIdentity, at: Instant): ClaimActivationResult;
  unlockPushRegistration(identity: ActivationIdentity, at: Instant): ActivationProgress;
}

function createActivationProgressKey({ accountId, campaignId }: ActivationIdentity): string {
  return `${KEY_PREFIX}:${accountId}:${campaignId}`;
}

function toActivationProgress(parsed: PersistedActivationProgress | null): ActivationProgress {
  if (parsed == null) {
    return EMPTY_ACTIVATION_PROGRESS;
  }
  return {
    todoCreatedAt: toNullableInstant(parsed.todoCreatedAt),
    activatedAt: toNullableInstant(parsed.activatedAt),
    pushRegistrationUnlockedAt: toNullableInstant(parsed.pushRegistrationUnlockedAt),
  };
}

export function createActivationProgressRepository(
  storage: ObservableSyncStorage,
): ActivationProgressRepository {
  const snapshots = new Map<string, { raw: string | undefined; progress: ActivationProgress }>();

  const get = (identity: ActivationIdentity): ActivationProgress => {
    const key = createActivationProgressKey(identity);
    const raw = storage.get(key);
    const cached = snapshots.get(key);
    if (cached != null && cached.raw === raw) {
      return cached.progress;
    }
    const progress = toActivationProgress(parseStoredJson(raw, persistedActivationProgressSchema));
    snapshots.set(key, { raw, progress });
    return progress;
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
    subscribe: (identity, listener) =>
      storage.subscribe(createActivationProgressKey(identity), listener),
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
