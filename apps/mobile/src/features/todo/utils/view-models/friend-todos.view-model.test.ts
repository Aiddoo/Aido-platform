import { createTodoDto } from '../../__tests__/todo.factories';
import { toTodo } from '../../apis/todo.mapper';
import { toFriendCategoryGroups } from './friend-todos.view-model';

describe('친구 할 일 목록 표시', () => {
  test('조회한 원본을 유지하면서 카테고리와 시간 표시를 조합한다', () => {
    // Given
    const first = toTodo(createTodoDto({ id: 1 }));
    const second = toTodo(
      createTodoDto({ id: 2, category: { id: 2, name: '스터디', color: '#123456', sortOrder: 1 } }),
    );
    const result = { todos: [first, second], hasNext: false, nextCursor: null };
    // When
    const twelveHour = toFriendCategoryGroups(result);
    const twentyFourHour = toFriendCategoryGroups(result);
    // Then
    expect(twelveHour.map((group) => group.category.name)).toEqual(['기본', '스터디']);
    expect(twelveHour[0]?.todos[0]).toBe(first);
    expect(twentyFourHour[1]?.todos[0]).toBe(second);
    expect(first.scheduledAtMs).toEqual(expect.any(Number));
    expect(first).not.toHaveProperty('formattedTime');
  });

  test('할 일이 없는 경우 빈 카테고리 목록을 반환한다', () => {
    // Given
    const todos = { todos: [], hasNext: false, nextCursor: null };
    // When
    const result = toFriendCategoryGroups(todos);
    // Then
    expect(result).toEqual([]);
  });
});
