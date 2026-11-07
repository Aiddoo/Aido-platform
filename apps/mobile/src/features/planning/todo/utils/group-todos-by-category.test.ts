import { createTodoCategoryWithCountDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';

import { createTodoDto } from '../__tests__/todo.fixtures';
import { toTodo } from '../apis/todo.mapper';
import { groupTodosByCategory } from './group-todos-by-category';

describe('카테고리별 할 일 묶기', () => {
  it('카테고리 순서를 유지하고 할 일이 없는 카테고리도 빈 목록으로 남긴다', () => {
    // Given
    const study = createTodoCategoryWithCountDto({ id: 2, name: '스터디' });
    const basic = createTodoCategoryWithCountDto({ id: 1, name: '기본' });
    const todo = toTodo(createTodoDto({ id: 1, category: { ...basic, sortOrder: 0 } }));

    // When
    const groups = groupTodosByCategory([todo], [study, basic]);

    // Then
    expect(groups.map((group) => group.category.name)).toEqual(['스터디', '기본']);
    expect(groups[0]?.todos).toEqual([]);
    expect(groups[1]?.todos[0]).toBe(todo);
  });

  it('할 일이 없으면 모든 카테고리가 빈 목록이다', () => {
    // When
    const groups = groupTodosByCategory([], []);

    // Then
    expect(groups).toEqual([]);
  });
});
