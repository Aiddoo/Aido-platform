import { createPlannedMemo, createPlannedTodo, createVoicePlan } from '../__tests__/voice.fixtures';
import type { VoicePlan } from '../domains/voice-plan.model';
import { getPlanHeadline, type PlanHeadline } from './plan-headline.view-model';

describe('getPlanHeadline', () => {
  it.each<{
    name: string;
    plan: VoicePlan;
    selection: Record<string, boolean>;
    expected: PlanHeadline;
  }>([
    {
      name: '고른 할 일이 있으면 그 수를 말한다',
      plan: createVoicePlan(
        createPlannedTodo({ actionId: 'a1' }),
        createPlannedTodo({ actionId: 'a2' }),
      ),
      selection: { a1: true, a2: false },
      expected: { kind: 'todos', count: 1 },
    },
    {
      name: '메모만 고르면 메모로 정리한 것이다',
      plan: createVoicePlan(
        createPlannedTodo({ actionId: 'a1', duplicateOfTodoId: 9 }),
        createPlannedMemo(),
      ),
      selection: { a1: false, m1: true },
      expected: { kind: 'memo' },
    },
    {
      name: '할 일이 전부 겹쳐 꺼져 있으면 이미 있는 것이다',
      plan: createVoicePlan(createPlannedTodo({ actionId: 'a1', duplicateOfTodoId: 9 })),
      selection: { a1: false },
      expected: { kind: 'already-added' },
    },
    {
      name: '사용자가 모두 끄면 나눈 수를 그대로 둔다',
      plan: createVoicePlan(
        createPlannedTodo({ actionId: 'a1' }),
        createPlannedTodo({ actionId: 'a2', duplicateOfTodoId: 9 }),
      ),
      selection: { a1: false, a2: false },
      expected: { kind: 'todos', count: 2 },
    },
    {
      name: '메모뿐인 계획은 메모를 꺼도 메모로 말한다',
      plan: createVoicePlan(createPlannedMemo()),
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
