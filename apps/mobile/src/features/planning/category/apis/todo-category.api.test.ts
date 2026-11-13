import { ok } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import {
  createTodoCategoryDeletionPreviewDto,
  createTodoCategoryDto,
  createTodoCategoryListDto,
} from '../__tests__/todo-category.fixtures';
import { TodoCategoryApi } from './todo-category.api';

const DELETION_RESULT = {
  todoHandling: 'none',
  todoCount: 0,
  seriesCount: 0,
  moveToCategoryId: null,
};

function createSut() {
  const httpClient = createHttpClientStub();
  const category = createTodoCategoryDto();
  httpClient.get.mockImplementation(async (url) =>
    url.endsWith('/deletion-preview')
      ? ok(createTodoCategoryDeletionPreviewDto())
      : ok(createTodoCategoryListDto()),
  );
  httpClient.post.mockResolvedValue(ok({ message: 'ok', category }));
  httpClient.patch.mockResolvedValue(ok({ message: 'ok', category }));
  httpClient.delete.mockResolvedValue(ok({ message: 'ok', result: DELETION_RESULT }));

  return { httpClient, api: new TodoCategoryApi(httpClient) };
}

describe('TodoCategoryApi', () => {
  it.each([
    {
      name: 'getCategories',
      call: (api: TodoCategoryApi) => api.getCategories(),
      method: 'get',
      args: ['v1/todo-categories', { signal: undefined }],
    },
    {
      name: 'createCategory',
      call: (api: TodoCategoryApi) => api.createCategory({ name: '운동', color: '#FF0000' }),
      method: 'post',
      args: ['v1/todo-categories', { name: '운동', color: '#FF0000' }],
    },
    {
      name: 'updateCategory',
      call: (api: TodoCategoryApi) => api.updateCategory(1, { name: '수정' }),
      method: 'patch',
      args: ['v1/todo-categories/1', { name: '수정' }],
    },
    {
      name: 'getDeletionPreview',
      call: (api: TodoCategoryApi) => api.getDeletionPreview(3),
      method: 'get',
      args: ['v1/todo-categories/3/deletion-preview', { signal: undefined }],
    },
    {
      name: 'reorderCategory',
      call: (api: TodoCategoryApi) =>
        api.reorderCategory(1, { position: 'after', targetCategoryId: 2 }),
      method: 'patch',
      args: ['v1/todo-categories/1/reorder', { position: 'after', targetCategoryId: 2 }],
    },
  ] as const)('$name은 계약 경로로 보내고 응답을 모델로 바꾼다', async ({ call, method, args }) => {
    // Given
    const { httpClient, api } = createSut();

    // When
    const result = await call(api);

    // Then
    expect(httpClient[method]).toHaveBeenCalledWith(...args);
    expect(result.ok).toBe(true);
  });

  it.each([
    {
      title: '옮기면 처리 방식과 옮길 곳을 보낸다',
      deletion: { todoHandling: 'move', moveToCategoryId: 1 },
      params: { todoHandling: 'move', moveToCategoryId: 1 },
    },
    {
      title: '함께 지우면 처리 방식만 보낸다',
      deletion: { todoHandling: 'delete', moveToCategoryId: null },
      params: { todoHandling: 'delete' },
    },
    {
      title: '옮기거나 지울 할 일이 없으면 아무 query도 보내지 않는다',
      deletion: { todoHandling: null, moveToCategoryId: null },
      params: {},
    },
  ] as const)('deleteCategory: $title', async ({ deletion, params }) => {
    // Given
    const { httpClient, api } = createSut();

    // When
    await api.deleteCategory(3, deletion);

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', { params });
  });
});
