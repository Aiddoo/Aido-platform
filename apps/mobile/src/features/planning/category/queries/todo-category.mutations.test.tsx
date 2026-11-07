import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError } from '@src/shared/errors/infra-error';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { createTodoCategoryDto } from '../__tests__/todo-category.fixtures';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type { TodoCategoriesResult } from '../schemas/todo-category.schema';
import {
  useCreateTodoCategoryMutationOptions,
  useUpdateTodoCategoryMutationOptions,
} from './todo-category.mutations';

const CATEGORIES: TodoCategoriesResult = {
  categories: [{ id: 1, name: '기본', color: '#3B82F6', sortOrder: 0, todoCount: 2 }],
};

async function renderMutations() {
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), CATEGORIES);
  const actions: {
    create?: ReturnType<typeof useCreate>;
    update?: ReturnType<typeof useUpdate>;
  } = {};
  function useCreate() {
    return useMutation(useCreateTodoCategoryMutationOptions());
  }
  function useUpdate() {
    return useMutation(useUpdateTodoCategoryMutationOptions());
  }
  function Capture() {
    actions.create = useCreate();
    actions.update = useUpdate();
    return null;
  }
  await renderUi(<Capture />, {
    queryClient,
    di: { httpClient, analytics, haptics: createHapticsGatewayStub() },
  });

  return {
    httpClient,
    analytics,
    cached: () => queryClient.getQueryData<TodoCategoriesResult>(TODO_CATEGORY_QUERY_KEYS.list()),
    create: (input: { name: string; color: string }) => actions.create?.mutateAsync(input),
    update: (id: number, input: { name: string; color?: string }) =>
      actions.update?.mutateAsync({ id, input }),
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
});
