import {
  createEmptyStoreReviewPromptState,
  STORE_REVIEW_DISMISSAL_COOLDOWN_MS,
  StoreReviewPromptPolicy,
  type StoreReviewPromptState,
  StoreReviewPromptTransitions,
} from './store-review-prompt.model';

const EMPTY_STATE: StoreReviewPromptState = {
  completions: [],
  dismissedAt: null,
  reviewRequestedAt: null,
};

describe('StoreReviewPromptPolicy', () => {
  it('서로 다른 이틀에 걸친 성공 완료 3회 이후에만 리뷰 제안을 허용한다', () => {
    const oneDay = [
      { todoId: 1, localDate: '2026-08-10' },
      { todoId: 2, localDate: '2026-08-10' },
      { todoId: 3, localDate: '2026-08-10' },
    ];
    const twoDays = [...oneDay.slice(0, 2), { todoId: 3, localDate: '2026-08-11' }];

    expect(
      StoreReviewPromptPolicy.shouldPrompt({ ...EMPTY_STATE, completions: oneDay }, new Date()),
    ).toBe(false);
    expect(
      StoreReviewPromptPolicy.shouldPrompt({ ...EMPTY_STATE, completions: twoDays }, new Date()),
    ).toBe(true);
  });

  it('거절 후 90일 동안 숨기고 쿨다운이 지나면 다시 허용한다', () => {
    const dismissedAt = new Date('2026-08-12T00:00:00.000Z');
    const eligible: StoreReviewPromptState = {
      ...EMPTY_STATE,
      completions: [
        { todoId: 1, localDate: '2026-08-10' },
        { todoId: 2, localDate: '2026-08-10' },
        { todoId: 3, localDate: '2026-08-11' },
      ],
      dismissedAt,
    };

    expect(
      StoreReviewPromptPolicy.shouldPrompt(
        eligible,
        new Date(dismissedAt.getTime() + STORE_REVIEW_DISMISSAL_COOLDOWN_MS - 1),
      ),
    ).toBe(false);
    expect(
      StoreReviewPromptPolicy.shouldPrompt(
        eligible,
        new Date(dismissedAt.getTime() + STORE_REVIEW_DISMISSAL_COOLDOWN_MS),
      ),
    ).toBe(true);
  });

  it('리뷰 요청을 선택한 뒤에는 다시 제안하지 않는다', () => {
    const requested: StoreReviewPromptState = {
      ...EMPTY_STATE,
      completions: [
        { todoId: 1, localDate: '2026-08-10' },
        { todoId: 2, localDate: '2026-08-10' },
        { todoId: 3, localDate: '2026-08-11' },
      ],
      reviewRequestedAt: new Date('2026-08-12T00:00:00.000Z'),
    };

    expect(StoreReviewPromptPolicy.shouldPrompt(requested, new Date('2027-08-12'))).toBe(false);
  });
});

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
