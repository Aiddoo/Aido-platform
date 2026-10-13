import { QueryClient } from '@tanstack/react-query';

import { createTodoDto } from '../__tests__/todo.factories';
import { todoSchema, TodoPolicy } from '../domains/todo.model';
import { toTodo } from './todo.mapper';

describe('Todo 클라이언트 모델과 캐시', () => {
  test('동일한 응답을 다시 받으면 기존 엔티티 참조를 유지한다', () => {
    // Given
    const queryClient = new QueryClient();
    const key = ['todo-cache-test'];
    const dto = createTodoDto();
    const todo = toTodo(dto);
    queryClient.setQueryData(key, [todo]);

    // When
    queryClient.setQueryData(key, [toTodo({ ...dto })]);

    // Then
    expect(queryClient.getQueryData<ReturnType<typeof toTodo>[]>(key)?.[0]).toBe(todo);
    expect(todoSchema.parse(todo)).toEqual(todo);
    queryClient.clear();
  });

  test('서버의 items와 itemStats를 클라이언트 하위 할 일 정책으로 소비한다', () => {
    const todo = toTodo(
      createTodoDto({
        recurrenceGroupId: 'recurring-group',
        items: [],
        itemStats: { total: 4, completed: 1 },
      }),
    );

    expect(TodoPolicy.isRecurring(todo)).toBe(true);
    expect(TodoPolicy.hasSubTodos(todo)).toBe(true);
    expect(TodoPolicy.completionProgress(todo)).toBe(0.25);
    expect(todo).not.toHaveProperty('itemStats');
    expect(todo).not.toHaveProperty('items');
  });
});
