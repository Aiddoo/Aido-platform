import { createDateKey } from '@src/testing/date-key';
import { ZodError } from 'zod';

import { createPlannedMemo, createPlannedTodo, createVoicePlan } from '../__tests__/voice.fixtures';
import {
  createDraftVoicePlan,
  createPlanReviewDraft,
  type PlanReviewDraft,
  PlanReviewDraftPolicy,
  type SelectablePlannedAction,
} from './plan-review-draft.model';
import { type VoicePlan, voicePlanIdSchema } from './voice-plan.model';

function createDraft(actions: SelectablePlannedAction[], omittedTodoCount = 0): PlanReviewDraft {
  return { omittedTodoCount, form: { actions } };
}

describe('createPlanReviewDraft', () => {
  it('이미 있는 할 일만 꺼 두고 새 할 일과 메모는 골라 둔 채 시작한다', () => {
    // Given
    const plan = {
      ...createVoicePlan(
        createPlannedTodo({ actionId: 'a1', duplicateOfTodoId: 9 }),
        createPlannedTodo({ actionId: 'a2' }),
        createPlannedMemo(),
      ),
      omittedTodoCount: 2,
    };

    // When
    const draft = createPlanReviewDraft(plan);

    // Then
    expect(draft.omittedTodoCount).toBe(2);
    expect(draft.form.actions.map(({ actionId, isSelected }) => [actionId, isSelected])).toEqual([
      ['a1', false],
      ['a2', true],
      ['m1', true],
    ]);
  });
});

describe('createDraftVoicePlan', () => {
  it('초안에서 고친 카드로 계획을 다시 만들고 고름 표시는 계획에 남기지 않는다', () => {
    // Given
    const draft = createDraft(
      [
        { ...createPlannedTodo({ actionId: 'a1', title: '영양제 두 알 먹기' }), isSelected: false },
        { ...createPlannedMemo(), isSelected: true },
      ],
      1,
    );
    const identity: Pick<VoicePlan, 'planId' | 'source' | 'sourceMemoId'> = {
      planId: voicePlanIdSchema.parse('plan-9'),
      source: 'voice-note',
      sourceMemoId: 31,
    };

    // When
    const plan = createDraftVoicePlan(identity, draft);

    // Then
    expect(plan).toEqual({
      ...identity,
      actions: [
        createPlannedTodo({ actionId: 'a1', title: '영양제 두 알 먹기' }),
        createPlannedMemo(),
      ],
      omittedTodoCount: 1,
    });
  });

  it('서버 계획으로 만든 초안을 그대로 되돌리면 처음 계획과 같다', () => {
    // Given
    const original = createVoicePlan(
      createPlannedTodo({ actionId: 'a1', duplicateOfTodoId: 9 }),
      createPlannedMemo(),
    );

    // When
    const restored = createDraftVoicePlan(original, createPlanReviewDraft(original));

    // Then
    expect(restored).toEqual(original);
  });
});

describe('PlanReviewDraftPolicy', () => {
  describe('getTodoCount', () => {
    it('고르지 않은 할 일도 세고 메모는 세지 않는다', () => {
      // Given
      const draft = createDraft([
        { ...createPlannedTodo({ actionId: 'a1' }), isSelected: true },
        { ...createPlannedTodo({ actionId: 'a2' }), isSelected: false },
        { ...createPlannedMemo(), isSelected: true },
      ]);

      // When
      const count = PlanReviewDraftPolicy.getTodoCount(draft);

      // Then
      expect(count).toBe(2);
    });
  });

  describe('hasTodo', () => {
    it.each([
      ['메모만 있으면 할 일이 없다', [{ ...createPlannedMemo(), isSelected: true }], false],
      [
        '고르지 않은 할 일이라도 있으면 할 일이 있다',
        [{ ...createPlannedTodo(), isSelected: false }],
        true,
      ],
      ['카드가 없으면 할 일이 없다', [], false],
    ])('%s', (_case, actions: SelectablePlannedAction[], expected) => {
      // When
      const hasTodo = PlanReviewDraftPolicy.hasTodo(createDraft(actions));

      // Then
      expect(hasTodo).toBe(expected);
    });
  });

  describe('getPlannedActions', () => {
    it('끝 날짜가 시작 날짜보다 앞선 카드는 계획으로 되돌리지 않고 던진다', () => {
      // Given
      const actions: SelectablePlannedAction[] = [
        {
          ...createPlannedTodo({
            startDate: createDateKey('2026-11-05'),
            endDate: createDateKey('2026-11-04'),
          }),
          isSelected: true,
        },
      ];

      // When
      const toPlannedActions = () => PlanReviewDraftPolicy.getPlannedActions(actions);

      // Then
      expect(toPlannedActions).toThrow(ZodError);
    });
  });

  describe('getSelection', () => {
    it('카드마다 고른 여부를 행동 id로 돌려준다', () => {
      // Given
      const actions: SelectablePlannedAction[] = [
        { ...createPlannedTodo({ actionId: 'a1' }), isSelected: false },
        { ...createPlannedMemo(), isSelected: true },
      ];

      // When
      const selection = PlanReviewDraftPolicy.getSelection(actions);

      // Then
      expect(selection).toEqual({ a1: false, m1: true });
    });
  });
});
