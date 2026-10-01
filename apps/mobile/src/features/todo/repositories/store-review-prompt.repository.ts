import { datetimeSchema } from '@aido/validators';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

import {
  createEmptyStoreReviewPromptState,
  STORE_REVIEW_MAX_COMPLETION_RECORDS,
  storeReviewCompletionSchema,
  storeReviewPromptStateSchema,
  type StoreReviewPromptState,
} from '../models/store-review-prompt.model';

const KEY_PREFIX = 'aido_store_review_prompt_v1';
const persistedStateSchema = z.object({
  completions: z.array(storeReviewCompletionSchema).max(STORE_REVIEW_MAX_COMPLETION_RECORDS),
  dismissedAt: datetimeSchema.nullable(),
  reviewRequestedAt: datetimeSchema.nullable(),
});
type StateTransition = (current: StoreReviewPromptState) => StoreReviewPromptState;

export interface StoreReviewPromptRepository {
  read(accountId: string): StoreReviewPromptState;
  update(accountId: string, transition: StateTransition): StoreReviewPromptState;
}

const storageKey = (accountId: string): string => `${KEY_PREFIX}:${accountId}`;

export function createStoreReviewPromptRepository(
  storage: SyncStorage,
): StoreReviewPromptRepository {
  const read = (accountId: string): StoreReviewPromptState => {
    const saved = storage.getString(storageKey(accountId));
    if (!saved) return createEmptyStoreReviewPromptState();
    try {
      const parsed = persistedStateSchema.safeParse(JSON.parse(saved));
      if (!parsed.success) return createEmptyStoreReviewPromptState();
      return storeReviewPromptStateSchema.parse({
        ...parsed.data,
        dismissedAt: parsed.data.dismissedAt ? new Date(parsed.data.dismissedAt) : null,
        reviewRequestedAt: parsed.data.reviewRequestedAt
          ? new Date(parsed.data.reviewRequestedAt)
          : null,
      });
    } catch {
      return createEmptyStoreReviewPromptState();
    }
  };

  const update = (accountId: string, transition: StateTransition): StoreReviewPromptState => {
    const current = read(accountId);
    const candidate = transition(current);
    if (candidate === current) return current;
    const next = storeReviewPromptStateSchema.parse(candidate);
    storage.set(
      storageKey(accountId),
      JSON.stringify({
        completions: next.completions,
        dismissedAt: next.dismissedAt?.toISOString() ?? null,
        reviewRequestedAt: next.reviewRequestedAt?.toISOString() ?? null,
      }),
    );
    return next;
  };
  return { read, update };
}
