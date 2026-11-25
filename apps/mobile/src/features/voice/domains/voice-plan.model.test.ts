import { createPlannedMemo, createPlannedTodo, createVoicePlan } from '../__tests__/voice.fixtures';
import { getPlannedCategoryId, VoicePlanPolicy } from './voice-plan.model';

describe('getPlannedCategoryId', () => {
  it.each([
    { scenario: '카테고리를 정한 카드는 그 카테고리', categoryId: 3, expected: 3 },
    { scenario: '카테고리가 없는 카드는 시트의 현재 카테고리', categoryId: null, expected: 7 },
  ])('$scenario에 넣는다', ({ categoryId, expected }) => {
    // When
    const result = getPlannedCategoryId(categoryId, 7);

    // Then
    expect(result).toBe(expected);
  });
});

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

  describe('isTodoAction', () => {
    it('할 일 카드면 true다', () => {
      // When
      const result = VoicePlanPolicy.isTodoAction(createPlannedTodo());

      // Then
      expect(result).toBe(true);
    });

    it('메모 카드면 false다', () => {
      // When
      const result = VoicePlanPolicy.isTodoAction(createPlannedMemo());

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isDuplicateAction', () => {
    it('이미 있는 할 일과 겹친다고 서버가 짚은 할 일 카드는 중복이다', () => {
      // Given
      const action = createPlannedTodo({ duplicateOfTodoId: 42 });

      // When
      const result = VoicePlanPolicy.isDuplicateAction(action);

      // Then
      expect(result).toBe(true);
    });

    it('겹치는 할 일이 없으면 중복이 아니다', () => {
      // Given
      const action = createPlannedTodo({ duplicateOfTodoId: null });

      // When
      const result = VoicePlanPolicy.isDuplicateAction(action);

      // Then
      expect(result).toBe(false);
    });

    it('메모 카드는 겹침을 보지 않는다', () => {
      // When
      const result = VoicePlanPolicy.isDuplicateAction(createPlannedMemo());

      // Then
      expect(result).toBe(false);
    });
  });
});
