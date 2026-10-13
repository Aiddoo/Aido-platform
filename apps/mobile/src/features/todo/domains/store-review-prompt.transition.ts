import {
  STORE_REVIEW_MAX_COMPLETION_RECORDS,
  type StoreReviewCompletion,
  type StoreReviewPromptState,
} from './store-review-prompt.model';

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
