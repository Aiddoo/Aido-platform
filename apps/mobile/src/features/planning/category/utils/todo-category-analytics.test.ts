import {
  getCategoryDeletedTodoHandling,
  getCategoryUpdatedField,
  toTodoCountBucket,
} from './todo-category-analytics';

describe('카테고리 수정 지표의 field', () => {
  it('색이 그대로면 name이다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const field = getCategoryUpdatedField(category, { color: '#3B82F6' });

    // Then
    expect(field).toBe('name');
  });

  it('색이 달라졌거나 기존 값을 모르면 color다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const changed = getCategoryUpdatedField(category, { color: '#51CF66' });
    const unknown = getCategoryUpdatedField(null, { color: '#51CF66' });

    // Then
    expect(changed).toBe('color');
    expect(unknown).toBe('color');
  });

  it('색을 보내지 않으면 name이다', () => {
    // Given
    const category = { color: '#3B82F6' };

    // When
    const field = getCategoryUpdatedField(category, {});

    // Then
    expect(field).toBe('name');
  });
});

describe('카테고리 삭제 지표의 할 일 수 구간', () => {
  it.each([
    { todoCount: 0, expected: '0' },
    { todoCount: 1, expected: '1_9' },
    { todoCount: 9, expected: '1_9' },
    { todoCount: 10, expected: '10_49' },
    { todoCount: 49, expected: '10_49' },
    { todoCount: 50, expected: '50_plus' },
  ])('할 일 $todoCount개는 $expected 구간이다', ({ todoCount, expected }) => {
    // When
    const bucket = toTodoCountBucket(todoCount);

    // Then
    expect(bucket).toBe(expected);
  });
});

describe('카테고리 삭제 지표의 todo_handling', () => {
  it.each([
    {
      title: '옮기면 move다',
      deletion: { todoHandling: 'move', moveToCategoryId: 2 },
      expected: 'move',
    },
    {
      title: '함께 지우면 delete다',
      deletion: { todoHandling: 'delete', moveToCategoryId: null },
      expected: 'delete',
    },
    {
      title: '옮기거나 지울 할 일이 없으면 empty다',
      deletion: { todoHandling: null, moveToCategoryId: null },
      expected: 'empty',
    },
  ] as const)('$title', ({ deletion, expected }) => {
    // When
    const todoHandling = getCategoryDeletedTodoHandling(deletion);

    // Then
    expect(todoHandling).toBe(expected);
  });
});
