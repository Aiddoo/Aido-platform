import { createEmptyStoreReviewPromptState } from './store-review-prompt.model';
import { StoreReviewPromptTransitions } from './store-review-prompt.transition';

describe('StoreReviewPromptTransitions', () => {
  it('같은 완료는 멱등이고 최근 50개만 보존한다', () => {
    let state = createEmptyStoreReviewPromptState();
    for (let todoId = 1; todoId <= 51; todoId += 1) {
      state = StoreReviewPromptTransitions.recordSuccessfulCompletion(state, {
        todoId,
        localDate: '2026-08-10',
      });
    }
    const duplicate = StoreReviewPromptTransitions.recordSuccessfulCompletion(state, {
      todoId: 51,
      localDate: '2026-08-10',
    });
    expect(duplicate).toBe(state);
    expect(state.completions).toHaveLength(50);
    expect(state.completions[0]?.todoId).toBe(2);
  });

  it('결정 전이는 완료 기록을 보존한다', () => {
    const state = StoreReviewPromptTransitions.recordSuccessfulCompletion(
      createEmptyStoreReviewPromptState(),
      { todoId: 1, localDate: '2026-08-10' },
    );
    const dismissed = StoreReviewPromptTransitions.recordDismissal(
      state,
      new Date('2026-08-12T00:00:00.000Z'),
    );
    expect(dismissed.completions).toEqual(state.completions);
    expect(dismissed.dismissedAt).toEqual(new Date('2026-08-12T00:00:00.000Z'));
  });
});
