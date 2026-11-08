import { todoItemResponseSchema } from '@aido/api';

import { createTodoItemResponseDto } from '../__tests__/todo.fixtures';
import { subTodoSchema } from '../domains/sub-todo.model';
import { toSubTodo } from './sub-todo.mapper';

describe('toSubTodo', () => {
  it('DTO → Domain 매핑', () => {
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

  it('완료 상태 매핑', () => {
    // Given
    const dto = createTodoItemResponseDto({ completed: true, sortOrder: 3 });

    // When
    const result = toSubTodo(dto);

    // Then
    expect(result.completed).toBe(true);
    expect(result.sortOrder).toBe(3);
  });
});

describe('계약 응답과 하위 항목 모델', () => {
  it('계약을 통과한 하위 항목을 매핑하면 모델 스키마를 통과한다', () => {
    // Given
    const dto = todoItemResponseSchema.parse(createTodoItemResponseDto({ completed: true }));

    // When
    const result = toSubTodo(dto);

    // Then
    expect(subTodoSchema.parse(result)).toEqual(result);
  });
});
