import { createPlanReviewDraftSchema, restoreDraftDateKey } from './plan-review-form.schema';

describe('restoreDraftDateKey 옛 초안의 달력 날짜 복원', () => {
  it.each([
    {
      label: '서울 자정',
      stored: '2026-11-09T15:00:00.000Z',
      timeZone: 'Asia/Seoul',
      expected: '2026-11-10',
    },
    {
      label: 'LA 자정(표준시)',
      stored: '2026-11-10T08:00:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-11-10',
    },
    {
      label: 'LA 서머타임이 끝나는 날의 자정',
      stored: '2026-11-01T07:00:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-11-01',
    },
    {
      label: 'LA 서머타임이 시작하는 날의 자정',
      stored: '2026-03-08T08:00:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-03-08',
    },
    {
      label: '서울에서 날짜 선택기로 고른 정오',
      stored: '2026-11-10T03:00:00.000Z',
      timeZone: 'Asia/Seoul',
      expected: '2026-11-10',
    },
    {
      label: 'LA에서 날짜 선택기로 고른 저녁',
      stored: '2026-11-11T03:00:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-11-10',
    },
    {
      label: '저장 뒤 시간대를 옮긴 초안은 지금 시간대의 날짜로 읽는다',
      stored: '2026-11-09T15:00:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-11-09',
    },
  ])('$label', ({ stored, timeZone, expected }) => {
    // When
    const dateKey = restoreDraftDateKey(stored, timeZone);

    // Then
    expect(dateKey).toBe(expected);
  });

  it.each(['Asia/Seoul', 'America/Los_Angeles'])(
    '새 초안의 달력 날짜는 %s에서도 그대로다',
    (timeZone) => {
      // When
      const dateKey = restoreDraftDateKey('2026-11-10', timeZone);

      // Then
      expect(dateKey).toBe('2026-11-10');
    },
  );
});

describe('createPlanReviewDraftSchema', () => {
  const planReviewDraftSchema = createPlanReviewDraftSchema('Asia/Seoul');
  const action = {
    type: 'create-todo',
    actionId: 'a1',
    title: '보고서 쓰기',
    endDate: null,
    scheduledTime: null,
    repeat: null,
    visibility: null,
    items: [],
    categoryId: 1,
    duplicateOfTodoId: null,
    isSelected: true,
  };

  it('옛 ISO 초안도 카드로 살리고 달력 날짜 키로 바꾼다', () => {
    // Given
    const stored = {
      omittedTodoCount: 0,
      form: { actions: [{ ...action, startDate: '2026-11-10T00:00:00.000Z' }] },
    };

    // When
    const draft = planReviewDraftSchema.parse(JSON.parse(JSON.stringify(stored)));

    // Then
    expect(draft.omittedTodoCount).toBe(0);
    expect(draft.form.actions[0]).toMatchObject({
      startDate: '2026-11-10',
    });
  });

  it('날짜를 읽지 못한 카드만 빼고 못 살린 수를 더한다', () => {
    // Given
    const stored = {
      omittedTodoCount: 1,
      form: {
        actions: [
          { ...action, startDate: '2026-11-10' },
          { ...action, actionId: 'a2', startDate: 'not-a-date' },
        ],
      },
    };

    // When
    const draft = planReviewDraftSchema.parse(stored);

    // Then
    expect(draft.omittedTodoCount).toBe(2);
    expect(draft.form.actions).toHaveLength(1);
  });
});
