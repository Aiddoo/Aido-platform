import {
  STORE_REVIEW_DISMISSAL_COOLDOWN_MS,
  StoreReviewPromptPolicy,
  type StoreReviewPromptState,
} from './store-review-prompt.policy';

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

  it('같은 할 일을 같은 날 다시 완료해도 완료 횟수를 중복 집계하지 않는다', () => {
    const once = StoreReviewPromptPolicy.recordSuccessfulCompletion(EMPTY_STATE, {
      todoId: 1,
      localDate: '2026-08-10',
    });
    const twice = StoreReviewPromptPolicy.recordSuccessfulCompletion(once, {
      todoId: 1,
      localDate: '2026-08-10',
    });

    expect(twice.completions).toEqual([{ todoId: 1, localDate: '2026-08-10' }]);
  });

  it('거절 후 90일 동안 숨기고 쿨다운이 지나면 다시 허용한다', () => {
    const eligible: StoreReviewPromptState = {
      ...EMPTY_STATE,
      completions: [
        { todoId: 1, localDate: '2026-08-10' },
        { todoId: 2, localDate: '2026-08-10' },
        { todoId: 3, localDate: '2026-08-11' },
      ],
      dismissedAt: '2026-08-12T00:00:00.000Z',
    };

    expect(
      StoreReviewPromptPolicy.shouldPrompt(
        eligible,
        new Date(
          Date.parse(eligible.dismissedAt as string) + STORE_REVIEW_DISMISSAL_COOLDOWN_MS - 1,
        ),
      ),
    ).toBe(false);
    expect(
      StoreReviewPromptPolicy.shouldPrompt(
        eligible,
        new Date(Date.parse(eligible.dismissedAt as string) + STORE_REVIEW_DISMISSAL_COOLDOWN_MS),
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
      reviewRequestedAt: '2026-08-12T00:00:00.000Z',
    };

    expect(StoreReviewPromptPolicy.shouldPrompt(requested, new Date('2027-08-12'))).toBe(false);
  });
});
