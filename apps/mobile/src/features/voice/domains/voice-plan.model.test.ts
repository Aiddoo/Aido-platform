import {
  getPlanActionGroups,
  type PlanHeadline,
  type PlannedMemo,
  type PlannedTodo,
  sortPlanActionsByGroup,
  type VoicePlan,
  voicePlanIdSchema,
  VoicePlanPolicy,
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

const FALLBACK_CATEGORY_ID = 7;

describe('getDefaultSelection', () => {
  it('이미 있는 할 일은 기본으로 꺼 둔다', () => {
    // Given
    const plan = createPlan(
      todo({ actionId: 'a1', duplicateOfTodoId: 9 }),
      todo({ actionId: 'a2' }),
      memo(),
    );

    // When
    const selection = VoicePlanPolicy.getDefaultSelection(plan);

    // Then
    expect(selection).toEqual({ a1: false, a2: true, m1: true });
  });
});

describe('getSelectedActions', () => {
  it('고른 행동만 돌려준다', () => {
    // Given
    const plan = createPlan(todo({ actionId: 'a1' }), todo({ actionId: 'a2' }));

    // When
    const selected = VoicePlanPolicy.getSelectedActions(plan, { a1: false, a2: true });

    // Then
    expect(selected.map((action) => action.actionId)).toEqual(['a2']);
  });
});

describe('canApplyPlan', () => {
  it('고른 행동이 하나도 없으면 적용할 수 없다', () => {
    // Given
    const plan = createPlan(todo({ actionId: 'a1' }), todo({ actionId: 'a2' }));

    // When
    const canApply = VoicePlanPolicy.canApplyPlan(plan, { a1: false, a2: false });

    // Then
    expect(canApply).toBe(false);
  });
});

describe('getSelectedTodoCount', () => {
  it('메모는 할 일 개수에 세지 않는다', () => {
    // Given
    const plan = createPlan(todo(), memo());

    // When
    const count = VoicePlanPolicy.getSelectedTodoCount(plan, { a1: true, m1: true });

    // Then
    expect(count).toBe(1);
  });
});

describe('getPlanActionGroups', () => {
  it.each([
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

  it('메모는 할 일 사이에 있어도 맨 뒤로 모으고 할 일 묶음을 끊지 않는다', () => {
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
});

describe('sortPlanActionsByGroup', () => {
  it('저장할 카드는 묶어 보인 순서대로 늘어놓는다', () => {
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

describe('getHeadline', () => {
  it.each<{
    name: string;
    plan: VoicePlan;
    selection: Record<string, boolean>;
    expected: PlanHeadline;
  }>([
    {
      name: '고른 할 일이 있으면 그 수를 말한다',
      plan: createPlan(todo({ actionId: 'a1' }), todo({ actionId: 'a2' })),
      selection: { a1: true, a2: false },
      expected: { kind: 'todos', count: 1 },
    },
    {
      name: '메모만 고르면 메모로 정리한 것이다',
      plan: createPlan(todo({ actionId: 'a1', duplicateOfTodoId: 9 }), memo()),
      selection: { a1: false, m1: true },
      expected: { kind: 'memo' },
    },
    {
      name: '할 일이 전부 겹쳐 꺼져 있으면 이미 있는 것이다',
      plan: createPlan(todo({ actionId: 'a1', duplicateOfTodoId: 9 })),
      selection: { a1: false },
      expected: { kind: 'already-added' },
    },
    {
      name: '사용자가 모두 끄면 나눈 수를 그대로 둔다',
      plan: createPlan(todo({ actionId: 'a1' }), todo({ actionId: 'a2', duplicateOfTodoId: 9 })),
      selection: { a1: false, a2: false },
      expected: { kind: 'todos', count: 2 },
    },
    {
      name: '메모뿐인 계획은 메모를 꺼도 메모로 말한다',
      plan: createPlan(memo()),
      selection: { m1: false },
      expected: { kind: 'memo' },
    },
  ])('$name', ({ plan, selection, expected }) => {
    // When
    const headline = VoicePlanPolicy.getHeadline(plan, selection);

    // Then
    expect(headline).toEqual(expected);
  });
});

describe('isTodoAction', () => {
  it('할 일 카드면 true다', () => {
    // When
    const result = VoicePlanPolicy.isTodoAction(todo());

    // Then
    expect(result).toBe(true);
  });

  it('메모 카드면 false다', () => {
    // When
    const result = VoicePlanPolicy.isTodoAction(memo());

    // Then
    expect(result).toBe(false);
  });
});

describe('isDuplicateAction', () => {
  it('이미 있는 할 일과 겹친다고 서버가 짚은 할 일 카드는 중복이다', () => {
    // Given
    const action = todo({ duplicateOfTodoId: 42 });

    // When
    const result = VoicePlanPolicy.isDuplicateAction(action);

    // Then
    expect(result).toBe(true);
  });

  it('겹치는 할 일이 없으면 중복이 아니다', () => {
    // Given
    const action = todo({ duplicateOfTodoId: null });

    // When
    const result = VoicePlanPolicy.isDuplicateAction(action);

    // Then
    expect(result).toBe(false);
  });

  it('메모 카드는 겹침을 보지 않는다', () => {
    // When
    const result = VoicePlanPolicy.isDuplicateAction(memo());

    // Then
    expect(result).toBe(false);
  });
});
