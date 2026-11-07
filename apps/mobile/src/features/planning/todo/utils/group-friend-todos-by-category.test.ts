import { createTodoDto } from '../__tests__/todo.fixtures';
import { toTodo } from '../apis/todo.mapper';
import type { Todo } from '../schemas/todo.schema';
import { groupFriendTodosByCategory } from './group-friend-todos-by-category';

describe('친구 할 일 목록 표시', () => {
  it('조회한 원본을 유지하면서 카테고리와 시간 표시를 조합한다', () => {
    // Given
    const first = toTodo(createTodoDto({ id: 1, scheduledLocalTime: '18:00' }));
    const second = toTodo(
      createTodoDto({ id: 2, category: { id: 2, name: '스터디', color: '#123456', sortOrder: 1 } }),
    );
    const todos = [first, second];
    // When
    const twelveHour = groupFriendTodosByCategory(todos);
    const twentyFourHour = groupFriendTodosByCategory(todos);
    // Then
    expect(twelveHour.map((group) => group.category.name)).toEqual(['기본', '스터디']);
    expect(twelveHour[0]?.todos[0]).toBe(first);
    expect(twentyFourHour[1]?.todos[0]).toBe(second);
    expect(first.localTime).toEqual(expect.any(String));
    expect(first).not.toHaveProperty('formattedTime');
  });

  it('할 일이 없는 경우 빈 카테고리 목록을 반환한다', () => {
    // Given
    const todos: Todo[] = [];
    // When
    const result = groupFriendTodosByCategory(todos);
    // Then
    expect(result).toEqual([]);
  });
});
