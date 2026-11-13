import { ok } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import { createTodoDto } from '../__tests__/todo.fixtures';
import { SubTodoApi } from './sub-todo.api';

function createSut() {
  const httpClient = createHttpClientStub();

  return { httpClient, api: new SubTodoApi(httpClient) };
}

describe('SubTodoApi', () => {
  it.each([
    {
      name: 'addSubTodo',
      call: (api: SubTodoApi) => api.addSubTodo(1, { title: '새 항목' }),
      method: 'post',
      args: ['v1/todos/1/items', { title: '새 항목' }],
    },
    {
      name: 'updateSubTodo',
      call: (api: SubTodoApi) => api.updateSubTodo(1, 10, { title: '수정된 항목' }),
      method: 'patch',
      args: ['v1/todos/1/items/10', { title: '수정된 항목' }],
    },
    {
      name: 'deleteSubTodo',
      call: (api: SubTodoApi) => api.deleteSubTodo(1, 10),
      method: 'delete',
      args: ['v1/todos/1/items/10'],
    },
    {
      name: 'reorderSubTodos',
      call: (api: SubTodoApi) => api.reorderSubTodos(1, { itemIds: [3, 1, 2] }),
      method: 'patch',
      args: ['v1/todos/1/items/reorder', { itemIds: [3, 1, 2] }],
    },
  ] as const)(
    '$name은 계약 경로로 보내고 응답을 할 일로 바꾼다',
    async ({ call, method, args }) => {
      // Given
      const { httpClient, api } = createSut();
      const response = ok({ message: 'ok', todo: createTodoDto() });
      httpClient.post.mockResolvedValue(response);
      httpClient.patch.mockResolvedValue(response);
      httpClient.delete.mockResolvedValue(response);

      // When
      const result = await call(api);

      // Then
      expect(httpClient[method]).toHaveBeenCalledWith(...args);
      expect(result.ok).toBe(true);
    },
  );

  describe('addSubTodo', () => {
    it('응답에 모르는 반복 빈도가 있어도 저장은 성공으로 읽고 규칙만 비운다', async () => {
      // Given
      const { httpClient, api } = createSut();
      const todo = { ...createTodoDto(), repeat: { frequency: 'YEARLY', end: { type: 'NEVER' } } };
      httpClient.post.mockResolvedValue({ ok: true, value: { message: '추가됨', todo } });

      // When
      const result = await api.addSubTodo(1, { title: '새 항목' });

      // Then
      expect(result.ok && result.value.repeat).toBeNull();
    });
  });
});
