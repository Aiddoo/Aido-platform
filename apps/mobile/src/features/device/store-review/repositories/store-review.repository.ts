import type { SyncStorage } from '@src/core/ports/sync-storage';

import {
  createEmptyStoreReviewState,
  type StoreReviewState,
  storeReviewStateSchema,
} from '../domains/store-review.model';
import { storeReviewStorageSchema } from '../schemas/store-review-storage.schema';

const KEY_PREFIX = 'aido_store_review_prompt_v1';

type StateTransition = (current: StoreReviewState) => StoreReviewState;

export interface StoreReviewRepository {
  /** 남긴 기록이 없거나 읽지 못하면 null이다 */
  find(accountId: string): StoreReviewState | null;
  /** 바뀌었을 때만 `{ version: 2, … }`로 쓴다 */
  update(accountId: string, transition: StateTransition): StoreReviewState;
  clear(accountId: string): void;
}

function createStoreReviewKey(accountId: string): string {
  return `${KEY_PREFIX}:${accountId}`;
}

export function createStoreReviewRepository(storage: SyncStorage): StoreReviewRepository {
  const find = (accountId: string): StoreReviewState | null => {
    const saved = storage.get(createStoreReviewKey(accountId));
    if (saved == null) {
      return null;
    }
    try {
      const current = storeReviewStorageSchema.safeParse(JSON.parse(saved));
      return current.success ? storeReviewStateSchema.parse(current.data) : null;
    } catch {
      return null;
    }
  };

  return {
    find,
    update: (accountId, transition) => {
      const current = find(accountId) ?? createEmptyStoreReviewState();
      const candidate = transition(current);
      if (candidate === current) {
        return current;
      }
      const next = storeReviewStateSchema.parse(candidate);
      storage.set(createStoreReviewKey(accountId), JSON.stringify({ version: 2, ...next }));
      return next;
    },
    clear: (accountId) => storage.remove(createStoreReviewKey(accountId)),
  };
}
