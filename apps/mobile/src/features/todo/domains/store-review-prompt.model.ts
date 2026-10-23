import { dateSchema } from '@aido/api';
import { z } from 'zod';

export const STORE_REVIEW_MAX_COMPLETION_RECORDS = 50;
export const storeReviewCompletionSchema = z.object({
  todoId: z.number().int().positive(),
  localDate: dateSchema,
});
export const storeReviewPromptStateSchema = z.object({
  completions: z.array(storeReviewCompletionSchema).max(STORE_REVIEW_MAX_COMPLETION_RECORDS),
  dismissedAt: z.date().nullable(),
  reviewRequestedAt: z.date().nullable(),
});
export type StoreReviewCompletion = z.infer<typeof storeReviewCompletionSchema>;
export type StoreReviewPromptState = z.infer<typeof storeReviewPromptStateSchema>;
export const createEmptyStoreReviewPromptState = (): StoreReviewPromptState => ({
  completions: [],
  dismissedAt: null,
  reviewRequestedAt: null,
});

const recordSuccessfulCompletion = (
  state: StoreReviewPromptState,
  completion: StoreReviewCompletion,
): StoreReviewPromptState => {
  const duplicate = state.completions.some(
    (item) => item.todoId === completion.todoId && item.localDate === completion.localDate,
  );
  return duplicate
    ? state
    : {
        ...state,
        completions: [...state.completions, completion].slice(-STORE_REVIEW_MAX_COMPLETION_RECORDS),
      };
};
const recordDismissal = (state: StoreReviewPromptState, at: Date): StoreReviewPromptState => ({
  ...state,
  dismissedAt: new Date(at.getTime()),
});
const recordReviewRequested = (
  state: StoreReviewPromptState,
  at: Date,
): StoreReviewPromptState => ({ ...state, reviewRequestedAt: new Date(at.getTime()) });

export const StoreReviewPromptTransitions = {
  recordSuccessfulCompletion,
  recordDismissal,
  recordReviewRequested,
} as const;

const DAY_MS = 86_400_000;

export const STORE_REVIEW_DISMISSAL_COOLDOWN_MS = 90 * DAY_MS;

const hasEnoughCompletions = (state: StoreReviewPromptState): boolean =>
  state.completions.length >= 3;
const hasEnoughCompletionDays = (state: StoreReviewPromptState): boolean =>
  new Set(state.completions.map(({ localDate }) => localDate)).size >= 2;
const hasNotRequestedReview = (state: StoreReviewPromptState): boolean =>
  state.reviewRequestedAt === null;
const hasDismissalCooldownElapsed = (state: StoreReviewPromptState, now: Date): boolean =>
  state.dismissedAt === null ||
  now.getTime() - state.dismissedAt.getTime() >= STORE_REVIEW_DISMISSAL_COOLDOWN_MS;
const shouldPrompt = (state: StoreReviewPromptState, now: Date): boolean =>
  hasNotRequestedReview(state) &&
  hasEnoughCompletions(state) &&
  hasEnoughCompletionDays(state) &&
  hasDismissalCooldownElapsed(state, now);

export const StoreReviewPromptPolicy = { shouldPrompt } as const;
