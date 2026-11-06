import {
  canApplyPlan,
  countSelectedTodos,
  getDefaultSelection,
  getPlanActionGroups,
  getSelectedActions,
  type PlannedMemo,
  type PlannedTodo,
  voicePlanIdSchema,
  type VoicePlan,
  sortPlanActionsByGroup,
  withRepeat,
  withStartDate,
} from './voice-plan.model';

const todo = (overrides: Partial<PlannedTodo> = {}): PlannedTodo => ({
  type: 'create-todo',
  actionId: 'a1',
  title: '영양제 먹기',
  startDate: '2026-11-05',
  endDate: null,
  scheduledTime: '08:00',
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
  ...overrides,
});

const memo = (): PlannedMemo => ({
  type: 'create-memo',
  actionId: 'm1',
  title: '',
  content: '내용',
});

const createPlan = (...actions: VoicePlan['actions']): VoicePlan => ({
  planId: voicePlanIdSchema.parse('plan-1'),
  source: 'quick-voice',
  sourceMemoId: null,
  actions,
  omittedTodoCount: 0,
});

describe('VoicePlanPolicy', () => {
  test('이미 있는 할 일은 기본으로 꺼 둔다', () => {
    // Given
    const plan = createPlan(
      todo({ actionId: 'a1', duplicateOfTodoId: 9 }),
      todo({ actionId: 'a2' }),
      memo(),
    );

    // When
    const selection = getDefaultSelection(plan);

    // Then
    expect(selection).toEqual({ a1: false, a2: true, m1: true });
  });

  test('고른 행동만 돌려주고 하나도 없으면 적용할 수 없다', () => {
    // Given
    const plan = createPlan(todo({ actionId: 'a1' }), todo({ actionId: 'a2' }));

    // When
    const selected = getSelectedActions(plan, { a1: false, a2: true });

    // Then
    expect(selected.map((action) => action.actionId)).toEqual(['a2']);
    expect(canApplyPlan(plan, { a1: false, a2: false })).toBe(false);
  });

  test('메모는 할 일 개수에 세지 않는다', () => {
    // Given
    const plan = createPlan(todo(), memo());

    // When & Then
    expect(countSelectedTodos(plan, { a1: true, m1: true })).toBe(1);
  });
});

describe('카드 묶기', () => {
  const FALLBACK_CATEGORY_ID = 7;

  test.each([
    {
      name: '나뉘어 나온 같은 카테고리는 처음 나온 자리로 모은다',
      categories: [1, 2, 1, 1],
      groups: [
        { categoryId: 1, indexes: [0, 2, 3] },
        { categoryId: 2, indexes: [1] },
      ],
    },
    {
      name: '카테고리가 없는 카드는 시트의 현재 카테고리로 묶는다',
      categories: [null, 2, 7],
      groups: [
        { categoryId: 7, indexes: [0, 2] },
        { categoryId: 2, indexes: [1] },
      ],
    },
    {
      name: '숫자가 큰 카테고리가 먼저 나오면 그 순서를 지킨다',
      categories: [9, 3],
      groups: [
        { categoryId: 9, indexes: [0] },
        { categoryId: 3, indexes: [1] },
      ],
    },
  ])('$name', ({ categories, groups }) => {
    // Given
    const actions = categories.map((categoryId) => todo({ categoryId }));

    // When
    const result = getPlanActionGroups(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result).toEqual(groups);
  });

  test('메모는 할 일 사이에 있어도 맨 뒤로 모으고 할 일 묶음을 끊지 않는다', () => {
    // Given
    const actions = [todo({ categoryId: 1 }), memo(), todo({ categoryId: 1 })];

    // When
    const result = getPlanActionGroups(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result).toEqual([
      { categoryId: 1, indexes: [0, 2] },
      { categoryId: null, indexes: [1] },
    ]);
  });

  test('저장할 카드는 묶어 보인 순서대로 늘어놓는다', () => {
    // Given
    const actions = [
      todo({ actionId: 'a', categoryId: 1 }),
      todo({ actionId: 'b', categoryId: 2 }),
      memo(),
      todo({ actionId: 'c', categoryId: 1 }),
    ];

    // When
    const result = sortPlanActionsByGroup(actions, FALLBACK_CATEGORY_ID);

    // Then
    expect(result.map(({ actionId }) => actionId)).toEqual(['a', 'c', 'b', 'm1']);
  });
});

describe('카드 고치기', () => {
  test('반복으로 바꾸면 기간(종료일)을 지운다', () => {
    // Given
    const period = todo({ endDate: '2026-11-07' });

    // When
    const result = withRepeat(period, { frequency: 'DAILY', end: { type: 'NEVER' } });

    // Then
    expect(result.endDate).toBeNull();
  });

  test.each([
    {
      label: '평일',
      startDate: '2026-11-05',
      endDate: '2026-11-07',
      movedTo: '2026-11-10',
      expected: '2026-11-12',
    },
    {
      label: 'LA 서머타임이 끝나는 날(25시간)을 낀 기간',
      startDate: '2026-10-31',
      endDate: '2026-11-02',
      movedTo: '2026-11-01',
      expected: '2026-11-03',
    },
    {
      label: 'LA 서머타임이 시작하는 날(23시간)을 낀 기간',
      startDate: '2026-03-07',
      endDate: '2026-03-09',
      movedTo: '2026-03-08',
      expected: '2026-03-10',
    },
    {
      label: '연말을 넘는 기간',
      startDate: '2026-12-30',
      endDate: '2027-01-02',
      movedTo: '2027-02-27',
      expected: '2027-03-02',
    },
  ])(
    '시작일을 옮기면 기간 일수를 유지한다: $label',
    ({ startDate, endDate, movedTo, expected }) => {
      // Given
      const period = todo({ startDate, endDate });

      // When
      const result = withStartDate(period, movedTo);

      // Then
      expect(result).toMatchObject({ startDate: movedTo, endDate: expected });
    },
  );
});
