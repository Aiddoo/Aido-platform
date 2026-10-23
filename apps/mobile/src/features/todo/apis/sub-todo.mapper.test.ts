import { createTodoItemResponseDto } from '../__tests__/todo.factories';
import { toSubTodo } from './sub-todo.mapper';

describe('toSubTodo', () => {
  test('DTO → Domain 매핑', () => {
    // Given
    const dto = createTodoItemResponseDto();

    // When
    const result = toSubTodo(dto);

    // Then
    expect(result).toEqual({
      id: 1,
      title: '테스트 항목',
      completed: false,
      sortOrder: 0,
    });
  });

  test('완료 상태 매핑', () => {
    // Given
    const dto = createTodoItemResponseDto({ completed: true, sortOrder: 3 });

    // When
    const result = toSubTodo(dto);

    // Then
    expect(result.completed).toBe(true);
    expect(result.sortOrder).toBe(3);
  });
});
