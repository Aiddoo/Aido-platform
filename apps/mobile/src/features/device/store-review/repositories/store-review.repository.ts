import type { SyncStorage } from '@src/core/ports/sync-storage';

import {
  createEmptyStoreReviewState,
  type StoreReviewState,
  storeReviewStateSchema,
  StoreReviewPolicy,
} from '../domains/store-review.model';
import {
  type LegacyStoreReviewStorage,
  legacyStoreReviewStorageSchema,
  storeReviewStorageSchema,
} from '../schemas/store-review-storage.schema';

const KEY_PREFIX = 'aido_store_review_prompt_v1';

type StateTransition = (current: StoreReviewState) => StoreReviewState;

export interface StoreReviewRepository {
  /** 남긴 기록이 없거나 읽지 못하면 null이다 */
  find(accountId: string): StoreReviewState | null;
  /** 바뀌었을 때만 `{ version: 2, … }`로 쓴다. 옛 모양은 여기서 새 모양으로 옮겨진다 */
  update(accountId: string, transition: StateTransition): StoreReviewState;
  clear(accountId: string): void;
}

function createStoreReviewKey(accountId: string): string {
  return `${KEY_PREFIX}:${accountId}`;
}

/** 이미 리뷰를 요청받은 사용자는 그 시각을 지난 요청 한 번으로 이어받아 곧바로 다시 묻지 않는다 */
function toStoreReviewState(legacy: LegacyStoreReviewStorage): StoreReviewState {
  return storeReviewStateSchema.parse({
    ...StoreReviewPolicy.withActiveDays(
      createEmptyStoreReviewState(),
      legacy.completions.map(({ localDate }) => localDate),
    ),
    requestedAt: legacy.reviewRequestedAt == null ? [] : [legacy.reviewRequestedAt],
  });
}

export function createStoreReviewRepository(storage: SyncStorage): StoreReviewRepository {
  const find = (accountId: string): StoreReviewState | null => {
    const saved = storage.get(createStoreReviewKey(accountId));
    if (saved == null) {
      return null;
    }
    try {
      const json: unknown = JSON.parse(saved);
      const current = storeReviewStorageSchema.safeParse(json);
      if (current.success) {
        return storeReviewStateSchema.parse(current.data);
      }
      const legacy = legacyStoreReviewStorageSchema.safeParse(json);
      // 읽기만 한다. 옛 모양은 다음 update가 새 모양으로 저장한다
      return legacy.success ? toStoreReviewState(legacy.data) : null;
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
