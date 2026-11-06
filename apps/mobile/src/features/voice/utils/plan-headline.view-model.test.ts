import {
  type PlannedMemo,
  type PlannedTodo,
  voicePlanIdSchema,
  type VoicePlan,
} from '../domains/voice-plan.model';
import { getPlanHeadline, type PlanHeadline } from './plan-headline.view-model';

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

describe('계획 머리글', () => {
  test.each<{
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
    const headline = getPlanHeadline(plan, selection);

    // Then
    expect(headline).toEqual(expected);
  });
});
