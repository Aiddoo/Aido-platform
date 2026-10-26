import { dateSchema, datetimeSchema } from '@aido/api';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

import {
  createEmptyStoreReviewState,
  STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS,
  STORE_REVIEW_MAX_REQUESTS_PER_WINDOW,
  storeReviewStateSchema,
  type StoreReviewState,
} from '../domains/store-review.model';

const KEY_PREFIX = 'aido_store_review_prompt_v1';

const persistedStateSchema = z.object({
  version: z.literal(2),
  activeDays: z.array(dateSchema).max(STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS),
  requestedAt: z.array(datetimeSchema).max(STORE_REVIEW_MAX_REQUESTS_PER_WINDOW),
});
type PersistedState = z.infer<typeof persistedStateSchema>;

/** 앱 안 확인 창을 쓰던 이전 저장 모양. 읽는 즉시 새 모양으로 옮겨 쓴다 */
const legacyPersistedStateSchema = z.object({
  completions: z.array(z.object({ localDate: dateSchema })),
  reviewRequestedAt: datetimeSchema.nullable(),
});
type LegacyPersistedState = z.infer<typeof legacyPersistedStateSchema>;

type StateTransition = (current: StoreReviewState) => StoreReviewState;

export interface StoreReviewRepository {
  read(accountId: string): StoreReviewState;
  update(accountId: string, transition: StateTransition): StoreReviewState;
}

const storageKey = (accountId: string): string => `${KEY_PREFIX}:${accountId}`;

const fromPersisted = (persisted: PersistedState): StoreReviewState =>
  storeReviewStateSchema.parse({
    activeDays: persisted.activeDays,
    requestedAt: persisted.requestedAt.map((requestedAt) => new Date(requestedAt)),
  });

/** 이미 리뷰를 요청받은 사용자는 그 시각을 지난 요청 한 번으로 이어받아 곧바로 다시 묻지 않는다 */
const fromLegacy = (legacy: LegacyPersistedState): StoreReviewState =>
  storeReviewStateSchema.parse({
    activeDays: [...new Set(legacy.completions.map(({ localDate }) => localDate))].slice(
      -STORE_REVIEW_MAX_ACTIVE_DAY_RECORDS,
    ),
    requestedAt: legacy.reviewRequestedAt == null ? [] : [new Date(legacy.reviewRequestedAt)],
  });

const toPersisted = (state: StoreReviewState): PersistedState => ({
  version: 2,
  activeDays: state.activeDays,
  requestedAt: state.requestedAt.map((requestedAt) => requestedAt.toISOString()),
});

export function createStoreReviewRepository(storage: SyncStorage): StoreReviewRepository {
  const write = (accountId: string, state: StoreReviewState): void => {
    storage.set(storageKey(accountId), JSON.stringify(toPersisted(state)));
  };

  const read = (accountId: string): StoreReviewState => {
    const saved = storage.getString(storageKey(accountId));
    if (saved == null) {
      return createEmptyStoreReviewState();
    }
    try {
      const json: unknown = JSON.parse(saved);
      const current = persistedStateSchema.safeParse(json);
      if (current.success) {
        return fromPersisted(current.data);
      }
      const legacy = legacyPersistedStateSchema.safeParse(json);
      if (!legacy.success) {
        return createEmptyStoreReviewState();
      }
      const migrated = fromLegacy(legacy.data);
      write(accountId, migrated);
      return migrated;
    } catch {
      return createEmptyStoreReviewState();
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
