import type { SyncStorage } from '@src/core/ports/sync-storage';
import { uniq } from 'es-toolkit';

import { STORE_REVIEW_MIN_ACTIVE_DAYS } from '../constants/store-review.constants';
import { StoreReviewPolicy } from '../domains/store-review.model';
import { type StoreReviewState, storeReviewStateSchema } from '../domains/store-review.model';
import {
  type LegacyStoreReviewStorage,
  legacyStoreReviewStorageSchema,
  storeReviewStorageSchema,
} from '../schemas/store-review-storage.schema';

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const KEY_PREFIX = 'aido_store_review_prompt_v1';

type StateTransition = (current: StoreReviewState) => StoreReviewState;

export interface StoreReviewRepository {
  get(accountId: string): StoreReviewState;
  update(accountId: string, transition: StateTransition): StoreReviewState;
}

function createStoreReviewKey(accountId: string): string {
  return `${KEY_PREFIX}:${accountId}`;
}

/** 이미 리뷰를 요청받은 사용자는 그 시각을 지난 요청 한 번으로 이어받아 곧바로 다시 묻지 않는다 */
function toStoreReviewState(legacy: LegacyStoreReviewStorage): StoreReviewState {
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

  const get = (accountId: string): StoreReviewState => {
    const saved = storage.get(createStoreReviewKey(accountId));
    if (saved == null) {
      return StoreReviewPolicy.createEmptyState();
    }
    try {
      const json: unknown = JSON.parse(saved);
      const current = storeReviewStorageSchema.safeParse(json);
      if (current.success) {
        return storeReviewStateSchema.parse(current.data);
      }
      const legacy = legacyStoreReviewStorageSchema.safeParse(json);
      if (!legacy.success) {
        return StoreReviewPolicy.createEmptyState();
      }
      // 읽기만 한다. 옛 모양은 다음 update가 새 모양으로 저장한다
      return toStoreReviewState(legacy.data);
    } catch {
      return StoreReviewPolicy.createEmptyState();
    }
  };

  const update = (accountId: string, transition: StateTransition): StoreReviewState => {
    const current = get(accountId);
    const candidate = transition(current);
    if (candidate === current) {
      return current;
    }
    const next = storeReviewStateSchema.parse(candidate);
    write(accountId, next);
    return next;
  };

  return { get, update };
}
