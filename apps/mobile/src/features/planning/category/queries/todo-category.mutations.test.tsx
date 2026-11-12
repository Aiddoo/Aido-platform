import '@src/shared/i18n/init';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createTodoDetails } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react-native';

import { createTodoCategoryDto } from '../__tests__/todo-category.fixtures';
import type {
  TodoCategoriesResult,
  TodoCategoryDeletionRequest,
} from '../domains/todo-category.model';
import { changeCachedCategoryTodoCount } from './todo-category-cache';
import { TODO_CATEGORY_QUERY_KEYS } from './todo-category-query-keys';
import {
  useCreateTodoCategoryMutationOptions,
  useDeleteTodoCategoryMutationOptions,
  useUpdateTodoCategoryMutationOptions,
} from './todo-category.mutations';

const CATEGORIES: TodoCategoriesResult = {
  categories: [
    { id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 2 },
    { id: 2, name: '업무', color: '#EF4444', sortOrder: 1, todoCount: 0 },
  ],
};
const MOVE_TO_WORK: TodoCategoryDeletionRequest = { todoHandling: 'move', moveToCategoryId: 2 };

async function renderMutations() {
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), CATEGORIES);
  const actions: {
    create?: ReturnType<typeof useCreate>;
    update?: ReturnType<typeof useUpdate>;
    remove?: ReturnType<typeof useRemove>;
  } = {};
  function useCreate() {
    return useMutation(useCreateTodoCategoryMutationOptions());
  }
  function useUpdate() {
    return useMutation(useUpdateTodoCategoryMutationOptions());
  }
  function useRemove() {
    return useMutation(useDeleteTodoCategoryMutationOptions());
  }
  function Capture() {
    actions.remove = useRemove();
    actions.create = useCreate();
    actions.update = useUpdate();
    return null;
  }
  await renderScreen(<Capture />, {
    di: createTestDi({
      ports: { httpClient, analytics, haptics: createHapticsGatewayStub(), queryClient },
    }),
  });

  return {
    httpClient,
    analytics,
    queryClient,
    cached: () => queryClient.getQueryData<TodoCategoriesResult>(TODO_CATEGORY_QUERY_KEYS.list()),
    create: (input: { name: string; color: string }) => actions.create?.mutateAsync(input),
    update: (id: number, input: { name: string; color?: string }) =>
      actions.update?.mutateAsync({ id, input }),
    remove: (id: number, deletion: TodoCategoryDeletionRequest = MOVE_TO_WORK) =>
      actions.remove?.mutateAsync({ id, deletion }),
  };
}

describe('카테고리 저장', () => {
  beforeEach(() => {
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('오프라인에서 만들기는 기다리지 않고 바로 실패해 목록을 되돌리고 알린다', async () => {
    // Given
    const { httpClient, cached, create } = await renderMutations();
    httpClient.post.mockRejectedValue(new NetworkError());

    // When
    const result = create({ name: '운동', color: '#51CF66' });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()).toEqual(CATEGORIES);
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });

  it('오프라인에서 고치기는 기다리지 않고 바로 실패해 이름을 되돌린다', async () => {
    // Given
    const { httpClient, cached, update } = await renderMutations();
    httpClient.patch.mockRejectedValue(new NetworkError());

    // When
    const result = update(1, { name: '새 이름' });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()).toEqual(CATEGORIES);
  });

  it('오프라인에서 지우기는 기다리지 않고 바로 실패하고 목록은 그대로다', async () => {
    // Given
    const { httpClient, cached, remove } = await renderMutations();
    httpClient.delete.mockRejectedValue(new NetworkError());

    // When
    const result = remove(1);

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()).toEqual(CATEGORIES);
  });
});

describe('카테고리 고치기 지표', () => {
  it('이름만 바꾸면 바뀐 칸을 name으로 남긴다', async () => {
    // Given
    const { httpClient, analytics, update } = await renderMutations();
    httpClient.patch.mockResolvedValue({
      ok: true,
      value: { message: '수정', category: createTodoCategoryDto({ name: '새 이름' }) },
    });

    // When
    await update(1, { name: '새 이름', color: '#3B82F6' });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('category_updated', { field: 'name' });
  });

  it('색을 바꾸면 바뀐 칸을 color로 남긴다', async () => {
    // Given
    const { httpClient, analytics, update } = await renderMutations();
    httpClient.patch.mockResolvedValue({
      ok: true,
      value: { message: '수정', category: createTodoCategoryDto({ color: '#51CF66' }) },
    });

    // When
    await update(1, { name: '기본', color: '#51CF66' });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('category_updated', { field: 'color' });
  });

  it('이름을 바꾸면 열린 할 일 상세도 다시 받아 바뀐 카테고리 이름을 보인다', async () => {
    // Given
    const { httpClient, queryClient, update } = await renderMutations();
    queryClient.setQueryData(TODO_QUERY_KEYS.detail({ todoId: 7 }), createTodoDetails());
    httpClient.patch.mockResolvedValue({
      ok: true,
      value: { message: '수정', category: createTodoCategoryDto({ name: '새 이름' }) },
    });

    // When
    await update(1, { name: '새 이름', color: '#3B82F6' });

    // Then
    await waitFor(() =>
      expect(queryClient.getQueryState(TODO_QUERY_KEYS.detail({ todoId: 7 }))?.isInvalidated).toBe(
        true,
      ),
    );
  });
});

describe('카테고리 지우기', () => {
  it('지우는 동안 목록에서 미리 빼지 않는다', async () => {
    // Given
    const { httpClient, cached, remove } = await renderMutations();
    const pendingDelete = createPendingResponse(
      ok({
        message: '삭제',
        result: { todoHandling: 'none', todoCount: 0, seriesCount: 0, moveToCategoryId: null },
      }),
    );
    httpClient.delete.mockReturnValue(pendingDelete.response);

    // When
    const result = remove(1);

    // Then
    expect(cached()).toEqual(CATEGORIES);
    pendingDelete.settle();
    await result;
  });

  it('옮기면 응답으로 목록을 바로 고치고, 옮긴 곳 이름과 개수로 알리고, 처리 방식과 개수 구간을 남긴다', async () => {
    // Given
    const { httpClient, analytics, cached, remove } = await renderMutations();
    httpClient.delete.mockResolvedValue({
      ok: true,
      value: {
        message: '삭제',
        result: { todoHandling: 'move', todoCount: 12, seriesCount: 1, moveToCategoryId: 2 },
      },
    });

    // When
    await remove(1);

    // Then
    // 업무 0개 + 옮긴 12개
    expect(cached()?.categories).toEqual([{ ...CATEGORIES.categories[1], todoCount: 12 }]);
    expect(await screen.findAllByText('할 일 12개를 ‘업무’ 카테고리로 옮겼어요')).not.toHaveLength(
      0,
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith('category_deleted', {
      todo_handling: 'move',
      todo_count_bucket: '10_49',
    });
  });

  it('응답으로 고친 카테고리 목록은 다시 받지 않고 할 일 상세는 다시 받는다', async () => {
    // Given
    const { httpClient, queryClient, remove } = await renderMutations();
    queryClient.setQueryData(TODO_QUERY_KEYS.detail({ todoId: 7 }), createTodoDetails());
    httpClient.delete.mockResolvedValue({
      ok: true,
      value: {
        message: '삭제',
        result: { todoHandling: 'move', todoCount: 2, seriesCount: 0, moveToCategoryId: 2 },
      },
    });

    // When
    await remove(1);

    // Then
    await waitFor(() =>
      expect(queryClient.getQueryState(TODO_QUERY_KEYS.detail({ todoId: 7 }))?.isInvalidated).toBe(
        true,
      ),
    );
    expect(queryClient.getQueryState(TODO_CATEGORY_QUERY_KEYS.list())?.isInvalidated).toBe(false);
  });
});

describe('카테고리 고치기와 동시에 바뀐 값', () => {
  it('이름 고치기가 실패하면 그 이름만 되돌리고 그사이 늘어난 할 일 수는 지킨다', async () => {
    // Given
    const { httpClient, queryClient, cached, update } = await renderMutations();
    const rejection = new ApiError('CATEGORY_0101', '이름을 바꾸지 못했어요', 409);
    const pendingUpdate = createPendingResponse(err(rejection));
    httpClient.patch.mockReturnValue(pendingUpdate.response);
    const result = update(1, { name: '새 이름' });
    await waitFor(() => expect(cached()?.categories[0]?.name).toBe('새 이름'));
    changeCachedCategoryTodoCount(queryClient, { categoryId: 1, delta: 1 });

    // When
    pendingUpdate.settle();

    // Then
    await expect(result).rejects.toBe(rejection);
    // 기본 2개 + 그사이 만든 1개
    expect(cached()?.categories).toEqual([
      { ...CATEGORIES.categories[0], todoCount: 3 },
      CATEGORIES.categories[1],
    ]);
    expect(await screen.findAllByText(rejection.message)).not.toHaveLength(0);
  });
});
