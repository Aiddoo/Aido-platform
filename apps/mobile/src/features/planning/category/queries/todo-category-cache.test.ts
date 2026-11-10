import { createTodoCategoryWithCount } from '../__tests__/todo-category.fixtures';
import {
  isOptimisticCategory,
  withCategoryDeleted,
  withOptimisticCategorySaved,
} from './todo-category-cache';

const PERSONAL = createTodoCategoryWithCount({ id: 1, name: '개인', todoCount: 4 });
const WORKOUT = createTodoCategoryWithCount({ id: 3, name: '운동', todoCount: 12 });

describe('withCategoryDeleted', () => {
  it('옮겼으면 지운 카테고리를 빼고 옮긴 곳에 옮긴 할 일 수를 더한다', () => {
    // Given
    const result = { categories: [PERSONAL, WORKOUT] };

    // When
    const next = withCategoryDeleted(result, WORKOUT.id, {
      todoHandling: 'move',
      todoCount: 12,
      seriesCount: 1,
      moveToCategoryId: PERSONAL.id,
    });

    // Then
    // 4개 + 옮긴 12개
    expect(next.categories).toEqual([{ ...PERSONAL, todoCount: 16 }]);
  });

  it.each([
    {
      title: '함께 지웠으면 다른 카테고리 개수는 그대로다',
      deletionResult: {
        todoHandling: 'delete',
        todoCount: 12,
        seriesCount: 1,
        moveToCategoryId: null,
      },
    },
    { title: '결과가 없는 옛 서버면 지운 카테고리만 뺀다', deletionResult: null },
  ] as const)('$title', ({ deletionResult }) => {
    // Given
    const result = { categories: [PERSONAL, WORKOUT] };

    // When
    const next = withCategoryDeleted(result, WORKOUT.id, deletionResult);

    // Then
    expect(next.categories).toEqual([PERSONAL]);
  });
});

describe('isOptimisticCategory', () => {
  it.each([
    { title: '서버 응답 전 임시 id(음수)는 임시 행이다', id: -1, expected: true },
    { title: '저장된 카테고리는 임시 행이 아니다', id: 3, expected: false },
  ])('$title', ({ id, expected }) => {
    // When
    const result = isOptimisticCategory({ id });

    // Then
    expect(result).toBe(expected);
  });
});

describe('withOptimisticCategorySaved', () => {
  it('만들기 응답의 서버 id·정렬로 임시 행만 바꾸고 할 일 수는 그대로 둔다', () => {
    // Given
    const optimistic = createTodoCategoryWithCount({ id: -5, name: '운동', sortOrder: 9 });
    const result = { categories: [PERSONAL, optimistic] };

    // When
    const next = withOptimisticCategorySaved(result, optimistic.id, {
      id: 8,
      name: '운동',
      color: optimistic.color,
      sortOrder: 2,
    });

    // Then
    expect(next.categories).toEqual([
      PERSONAL,
      { id: 8, name: '운동', color: optimistic.color, sortOrder: 2, todoCount: 0 },
    ]);
  });
});
