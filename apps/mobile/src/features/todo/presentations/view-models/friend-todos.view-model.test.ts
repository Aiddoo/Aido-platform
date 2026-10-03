import { createTodoDto } from '../../__tests__/todo.factories';
import { toTodoItem } from '../../services/todo.mapper';
import { toFriendCategoryGroups } from './friend-todos.view-model';

describe('친구 할 일 목록 표시', () => {
  test('조회한 원본을 유지하면서 카테고리와 시간 표시를 조합한다', () => {
    // Given
    const first = toTodoItem(createTodoDto({ id: 1 }));
    const second = toTodoItem(
      createTodoDto({ id: 2, category: { id: 2, name: '스터디', color: '#123456', sortOrder: 1 } }),
    );
    const result = { todos: [first, second], hasNext: false, nextCursor: null };
    // When
    const twelveHour = toFriendCategoryGroups(result, 'TWELVE_HOUR');
    const twentyFourHour = toFriendCategoryGroups(result, 'TWENTY_FOUR_HOUR');
    // Then
    expect(twelveHour.map((group) => group.category.name)).toEqual(['기본', '스터디']);
    expect(twelveHour[0]?.todos[0]?.formattedTime).not.toBe(
      twentyFourHour[0]?.todos[0]?.formattedTime,
    );
    expect(first.scheduledTime).toBeInstanceOf(Date);
    expect(first).not.toHaveProperty('formattedTime');
  });

  test('할 일이 없는 경우 빈 카테고리 목록을 반환한다', () => {
    // Given
    const todos = { todos: [], hasNext: false, nextCursor: null };
    // When
    const result = toFriendCategoryGroups(todos, 'TWENTY_FOUR_HOUR');
    // Then
    expect(result).toEqual([]);
  });
});
