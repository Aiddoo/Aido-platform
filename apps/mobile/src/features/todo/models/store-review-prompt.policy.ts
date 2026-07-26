const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_COMPLETION_RECORDS = 50;

export const STORE_REVIEW_DISMISSAL_COOLDOWN_MS = 90 * DAY_MS;

export interface StoreReviewCompletion {
  todoId: number;
  /** 사용자의 기기 로컬 날짜(YYYY-MM-DD). */
  localDate: string;
}

export interface StoreReviewPromptState {
  completions: StoreReviewCompletion[];
  dismissedAt: string | null;
  reviewRequestedAt: string | null;
}

function recordSuccessfulCompletion(
  state: StoreReviewPromptState,
  completion: StoreReviewCompletion,
): StoreReviewPromptState {
  const alreadyRecorded = state.completions.some(
    (item) => item.todoId === completion.todoId && item.localDate === completion.localDate,
  );
  if (alreadyRecorded) {
    return state;
  }

  return {
    ...state,
    completions: [...state.completions, completion].slice(-MAX_COMPLETION_RECORDS),
  };
}

function shouldPrompt(state: StoreReviewPromptState, now: Date): boolean {
  if (state.reviewRequestedAt !== null || state.completions.length < 3) {
    return false;
  }

  const completionDays = new Set(state.completions.map(({ localDate }) => localDate));
  if (completionDays.size < 2) {
    return false;
  }

  if (state.dismissedAt === null) {
    return true;
  }

  const dismissedAt = Date.parse(state.dismissedAt);
  return (
    Number.isNaN(dismissedAt) || now.getTime() - dismissedAt >= STORE_REVIEW_DISMISSAL_COOLDOWN_MS
  );
}

export const StoreReviewPromptPolicy = {
  recordSuccessfulCompletion,
  shouldPrompt,
} as const;
