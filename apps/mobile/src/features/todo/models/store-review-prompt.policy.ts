import type { StoreReviewPromptState } from './store-review-prompt.model';

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
