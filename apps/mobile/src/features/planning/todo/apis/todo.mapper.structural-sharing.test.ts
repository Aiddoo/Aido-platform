import { createTestQueryClient } from '@src/shared/__tests__';

import { createTodoDto, createTodoItemResponseDto } from '../__tests__/todo.fixtures';
import { SubTodoPolicy } from '../domains/sub-todo.model';
import { TodoPolicy } from '../domains/todo.model';
import { todoSchema } from '../domains/todo.model';
import { toTodo } from './todo.mapper';

describe('Todo 클라이언트 모델과 캐시', () => {
  it('동일한 응답을 다시 받으면 기존 엔티티 참조를 유지한다', () => {
    // Given
    const queryClient = createTestQueryClient();
    const key = ['todo-cache-test'];
    const dto = createTodoDto();
    const todo = toTodo(dto);
    queryClient.setQueryData(key, [todo]);

    // When
    queryClient.setQueryData(key, [toTodo({ ...dto })]);

    // Then
    expect(queryClient.getQueryData<ReturnType<typeof toTodo>[]>(key)?.[0]).toBe(todo);
    expect(todoSchema.parse(todo)).toEqual(todo);
  });

  it('서버의 items를 항목 목록 하나로 받고 진행 숫자는 그 목록에서 센다', () => {
    // Given
    const dto = createTodoDto({
      recurrenceGroupId: 'recurring-group',
      items: [1, 2, 3, 4].map((id) => createTodoItemResponseDto({ id, completed: id === 1 })),
      itemStats: { total: 4, completed: 1 },
    });

    // When
    const todo = toTodo(dto);

    // Then
    expect(TodoPolicy.isRecurringTodo(todo)).toBe(true);
    expect(SubTodoPolicy.getSubTodoStats(todo.subTodos)).toEqual({ total: 4, completed: 1 });
    expect(todo).not.toHaveProperty('itemStats');
    expect(todo).not.toHaveProperty('subTodoStats');
    expect(todo).not.toHaveProperty('items');
  });
});
