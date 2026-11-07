import type { SyncStorage } from '@src/core/ports/sync-storage';
import { uniq } from 'es-toolkit';

import { STORE_REVIEW_MIN_ACTIVE_DAYS } from '../constants/store-review.constants';
import { StoreReviewPolicy } from '../domains/store-review.model';
import {
  type LegacyStoreReviewState,
  legacyStoreReviewStateSchema,
  persistedStoreReviewStateSchema,
} from '../schemas/store-review-persisted.schema';
import { type StoreReviewState, storeReviewStateSchema } from '../schemas/store-review.schema';

const KEY_PREFIX = 'aido_store_review_prompt_v1';

type StateTransition = (current: StoreReviewState) => StoreReviewState;

export interface StoreReviewRepository {
  read(accountId: string): StoreReviewState;
  update(accountId: string, transition: StateTransition): StoreReviewState;
}

function createStoreReviewKey(accountId: string): string {
  return `${KEY_PREFIX}:${accountId}`;
}

/** 이미 리뷰를 요청받은 사용자는 그 시각을 지난 요청 한 번으로 이어받아 곧바로 다시 묻지 않는다 */
function fromLegacy(legacy: LegacyStoreReviewState): StoreReviewState {
  return storeReviewStateSchema.parse({
    activeDays: uniq(legacy.completions.map(({ localDate }) => localDate)).slice(
      -STORE_REVIEW_MIN_ACTIVE_DAYS,
    ),
    requestedAt: legacy.reviewRequestedAt == null ? [] : [legacy.reviewRequestedAt],
  });
}

export function createStoreReviewRepository(storage: SyncStorage): StoreReviewRepository {
  const write = (accountId: string, state: StoreReviewState): void => {
    storage.set(createStoreReviewKey(accountId), JSON.stringify({ version: 2, ...state }));
  };

  const read = (accountId: string): StoreReviewState => {
    const saved = storage.get(createStoreReviewKey(accountId));
    if (saved == null) {
      return StoreReviewPolicy.createEmptyState();
    }
    try {
      const json: unknown = JSON.parse(saved);
      const current = persistedStoreReviewStateSchema.safeParse(json);
      if (current.success) {
        return storeReviewStateSchema.parse(current.data);
      }
      const legacy = legacyStoreReviewStateSchema.safeParse(json);
      if (!legacy.success) {
        return StoreReviewPolicy.createEmptyState();
      }
      const migrated = fromLegacy(legacy.data);
      write(accountId, migrated);
      return migrated;
    } catch {
      return StoreReviewPolicy.createEmptyState();
    }
  };

  const update = (accountId: string, transition: StateTransition): StoreReviewState => {
    const current = read(accountId);
    const candidate = transition(current);
    if (candidate === current) {
      return current;
    }
    const next = storeReviewStateSchema.parse(candidate);
    write(accountId, next);
    return next;
  };

  return { read, update };
}
