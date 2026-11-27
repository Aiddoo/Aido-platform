import { createPlannedMemo, createPlannedTodo } from '../__tests__/voice.fixtures';
import { getPlannedCategoryId, PlannedActionPolicy } from './planned-action.model';

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

describe('PlannedActionPolicy', () => {
  describe('isTodoAction', () => {
    it('할 일 카드면 true다', () => {
      // When
      const result = PlannedActionPolicy.isTodoAction(createPlannedTodo());

      // Then
      expect(result).toBe(true);
    });

    it('메모 카드면 false다', () => {
      // When
      const result = PlannedActionPolicy.isTodoAction(createPlannedMemo());

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isDuplicateAction', () => {
    it('이미 있는 할 일과 겹친다고 서버가 짚은 할 일 카드는 중복이다', () => {
      // Given
      const action = createPlannedTodo({ duplicateOfTodoId: 42 });

      // When
      const result = PlannedActionPolicy.isDuplicateAction(action);

      // Then
      expect(result).toBe(true);
    });

    it('겹치는 할 일이 없으면 중복이 아니다', () => {
      // Given
      const action = createPlannedTodo({ duplicateOfTodoId: null });

      // When
      const result = PlannedActionPolicy.isDuplicateAction(action);

      // Then
      expect(result).toBe(false);
    });

    it('메모 카드는 겹침을 보지 않는다', () => {
      // When
      const result = PlannedActionPolicy.isDuplicateAction(createPlannedMemo());

      // Then
      expect(result).toBe(false);
    });
  });
});
