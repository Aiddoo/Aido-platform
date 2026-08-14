import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

import {
  type StoreReviewCompletion,
  StoreReviewPromptPolicy,
  type StoreReviewPromptState,
} from '../models/store-review-prompt.policy';

const KEY_PREFIX = 'aido_store_review_prompt_v1';
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const stateSchema = z.object({
  completions: z.array(
    z.object({
      todoId: z.number().int().positive(),
      localDate: localDateSchema,
    }),
  ),
  dismissedAt: isoDateSchema.nullable(),
  reviewRequestedAt: isoDateSchema.nullable(),
});

const EMPTY_STATE: StoreReviewPromptState = {
  completions: [],
  dismissedAt: null,
  reviewRequestedAt: null,
};

export interface StoreReviewPromptRepository {
  read(accountId: string): StoreReviewPromptState;
  recordSuccessfulCompletion(
    accountId: string,
    completion: StoreReviewCompletion,
  ): StoreReviewPromptState;
  recordDismissal(accountId: string, dismissedAt: Date): StoreReviewPromptState;
  recordReviewRequested(accountId: string, requestedAt: Date): StoreReviewPromptState;
}

const storageKey = (accountId: string): string => `${KEY_PREFIX}:${accountId}`;

export function createStoreReviewPromptRepository(
  storage: SyncStorage,
): StoreReviewPromptRepository {
  const read = (accountId: string): StoreReviewPromptState => {
    const saved = storage.getString(storageKey(accountId));
    if (!saved) {
      return { ...EMPTY_STATE };
    }

    try {
      const parsed = stateSchema.safeParse(JSON.parse(saved));
      return parsed.success ? parsed.data : { ...EMPTY_STATE };
    } catch {
      return { ...EMPTY_STATE };
    }
  };

  const write = (accountId: string, state: StoreReviewPromptState): StoreReviewPromptState => {
    storage.set(storageKey(accountId), JSON.stringify(state));
    return state;
  };

  return {
    read,
    recordSuccessfulCompletion(accountId, completion) {
      return write(
        accountId,
        StoreReviewPromptPolicy.recordSuccessfulCompletion(read(accountId), completion),
      );
    },
    recordDismissal(accountId, dismissedAt) {
      return write(accountId, {
        ...read(accountId),
        dismissedAt: dismissedAt.toISOString(),
      });
    },
    recordReviewRequested(accountId, requestedAt) {
      return write(accountId, {
        ...read(accountId),
        reviewRequestedAt: requestedAt.toISOString(),
      });
    },
  };
}
