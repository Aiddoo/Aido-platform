import { todoItemResponseSchema } from '@aido/api';

import { createTodoItemResponseDto } from '../__tests__/todo.fixtures';
import { subTodoSchema } from '../domains/sub-todo.model';
import { toSubTodo } from './sub-todo.mapper';

describe('toSubTodo', () => {
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
});
