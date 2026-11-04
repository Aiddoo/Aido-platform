import {
  canApplyPlan,
  countSelectedTodos,
  getDefaultSelection,
  getSelectedActions,
  type PlannedMemo,
  type PlannedTodo,
  voicePlanIdSchema,
  type VoicePlan,
  withRepeat,
  withStartDate,
} from './voice-plan.model';

const todo = (overrides: Partial<PlannedTodo> = {}): PlannedTodo => ({
  type: 'create-todo',
  actionId: 'a1',
  title: '영양제 먹기',
  startDate: new Date(2026, 10, 5),
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

const planOf = (...actions: VoicePlan['actions']): VoicePlan => ({
  planId: voicePlanIdSchema.parse('plan-1'),
  source: 'quick-voice',
  sourceMemoId: null,
  actions,
  omittedTodoCount: 0,
});

describe('VoicePlanPolicy', () => {
  test('이미 있는 할 일은 기본으로 꺼 둔다', () => {
    // Given
    const plan = planOf(
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
    const plan = planOf(todo({ actionId: 'a1' }), todo({ actionId: 'a2' }));

    // When
    const selected = getSelectedActions(plan, { a1: false, a2: true });

    // Then
    expect(selected.map((action) => action.actionId)).toEqual(['a2']);
    expect(canApplyPlan(plan, { a1: false, a2: false })).toBe(false);
  });

  test('메모는 할 일 개수에 세지 않는다', () => {
    // Given
    const plan = planOf(todo(), memo());

    // When & Then
    expect(countSelectedTodos(plan, { a1: true, m1: true })).toBe(1);
  });
});

describe('카드 고치기', () => {
  test('반복으로 바꾸면 기간(종료일)을 지운다', () => {
    // Given
    const period = todo({ endDate: new Date(2026, 10, 7) });

    // When
    const result = withRepeat(period, { frequency: 'DAILY', end: { type: 'NEVER' } });

    // Then
    expect(result.endDate).toBeNull();
  });

  test('시작일을 옮기면 기간 길이를 유지한다', () => {
    // Given
    const period = todo({ endDate: new Date(2026, 10, 7) });

    // When
    const result = withStartDate(period, new Date(2026, 10, 10));

    // Then
    expect(result.endDate).toEqual(new Date(2026, 10, 12));
  });
});
