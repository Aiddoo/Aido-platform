import { createPlannedMemo, createPlannedTodo, createVoicePlan } from '../__tests__/voice.fixtures';
import { VoicePlanPolicy } from './voice-plan.model';

describe('VoicePlanPolicy', () => {
  describe('getDefaultSelection', () => {
    it('이미 있는 할 일은 기본으로 꺼 둔다', () => {
      // Given
      const plan = createVoicePlan(
        createPlannedTodo({ actionId: 'a1', duplicateOfTodoId: 9 }),
        createPlannedTodo({ actionId: 'a2' }),
        createPlannedMemo(),
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
      const plan = createVoicePlan(
        createPlannedTodo({ actionId: 'a1' }),
        createPlannedTodo({ actionId: 'a2' }),
      );

      // When
      const selected = VoicePlanPolicy.getSelectedActions(plan, { a1: false, a2: true });

      // Then
      expect(selected.map((action) => action.actionId)).toEqual(['a2']);
    });
  });

  describe('canApplyPlan', () => {
    it('고른 행동이 하나도 없으면 적용할 수 없다', () => {
      // Given
      const plan = createVoicePlan(
        createPlannedTodo({ actionId: 'a1' }),
        createPlannedTodo({ actionId: 'a2' }),
      );

      // When
      const canApply = VoicePlanPolicy.canApplyPlan(plan, { a1: false, a2: false });

      // Then
      expect(canApply).toBe(false);
    });
  });

  describe('getSelectedTodoCount', () => {
    it('메모는 할 일 개수에 세지 않는다', () => {
      // Given
      const plan = createVoicePlan(createPlannedTodo(), createPlannedMemo());

      // When
      const count = VoicePlanPolicy.getSelectedTodoCount(plan, { a1: true, m1: true });

      // Then
      expect(count).toBe(1);
    });
  });
});
