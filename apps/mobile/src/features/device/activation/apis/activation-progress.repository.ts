import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, toNullableInstant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { EMPTY_ACTIVATION_PROGRESS } from '../constants/activation.constants';
import type { ActivationProgress } from '../domains/activation.model';
import {
  type ActivationProgressStorage,
  activationProgressStorageSchema,
} from '../schemas/activation-progress-storage.schema';

const KEY_PREFIX = 'aido_activation_v2';
/** 1.15.0 이하가 계정·캠페인별로 쓰던 키. 진행은 서버 할 일 기록으로도 다시 채워져 옮기지 않고 지운다 */
const RETIRED_KEY_PREFIX = 'aido_activation_v1';

interface ClaimActivationResult {
  isClaimed: boolean;
  progress: ActivationProgress;
}

export interface ActivationProgressRepository {
  /** 저장값이 그대로면 같은 객체를 돌려준다(`useSyncExternalStore`의 스냅샷) */
  get(accountId: string): ActivationProgress;
  subscribe(accountId: string, listener: () => void): () => void;
  markTodoCreated(accountId: string, at: Instant): ActivationProgress;
  claimActivated(accountId: string, at: Instant): ClaimActivationResult;
  removeRetiredKeys(): void;
}

function createActivationProgressKey(accountId: string): string {
  return `${KEY_PREFIX}:${accountId}`;
}

function toActivationProgress(parsed: ActivationProgressStorage | null): ActivationProgress {
  if (parsed == null) {
    return EMPTY_ACTIVATION_PROGRESS;
  }
  return {
    todoCreatedAt: toNullableInstant(parsed.todoCreatedAt),
    activatedAt: toNullableInstant(parsed.activatedAt),
  };
}

export function createActivationProgressRepository(
  storage: ObservableSyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): ActivationProgressRepository {
  const snapshots = new Map<string, { raw: string | undefined; progress: ActivationProgress }>();

  const get = (accountId: string): ActivationProgress => {
    const key = createActivationProgressKey(accountId);
    const raw = storage.get(key);
    const cached = snapshots.get(key);
    if (cached != null && cached.raw === raw) {
      return cached.progress;
    }
    const progress = toActivationProgress(parseStoredJson(raw, activationProgressStorageSchema));
    snapshots.set(key, { raw, progress });
    return progress;
  };

  const save = (accountId: string, progress: ActivationProgress): boolean => {
    try {
      storage.set(createActivationProgressKey(accountId), JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  };

  return {
    get,
    subscribe: (accountId, listener) =>
      storage.subscribe(createActivationProgressKey(accountId), listener),
    markTodoCreated: (accountId, at) => {
      const current = get(accountId);
      if (current.todoCreatedAt) {
        return current;
      }
      const next = { ...current, todoCreatedAt: at };
      return save(accountId, next) ? next : current;
    },
    claimActivated: (accountId, at) => {
      const current = get(accountId);
      if (!current.todoCreatedAt || current.activatedAt) {
        return { isClaimed: false, progress: current };
      }

      const next = { ...current, activatedAt: at };
      return save(accountId, next)
        ? { isClaimed: true, progress: next }
        : { isClaimed: false, progress: current };
    },
    removeRetiredKeys: () => {
      storage
        .keys()
        .filter((key) => key.startsWith(`${RETIRED_KEY_PREFIX}:`))
        .forEach((key) => storage.remove(key));
    },
  };
}
