import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors/infra-error';
import { onlineManager, useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import { createTodoCategoryDto } from '../__tests__/todo-category.fixtures';
import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import type { TodoCategoriesResult, TodoCategoryDeletion } from '../domains/todo-category.model';
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
const MOVE_TO_WORK: TodoCategoryDeletion = { todoHandling: 'move', moveToCategoryId: 2 };

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
    remove: (id: number, deletion: TodoCategoryDeletion = MOVE_TO_WORK) =>
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
});

describe('카테고리 지우기', () => {
  it('지우는 동안 목록에서 미리 빼지 않는다', async () => {
    // Given
    const { httpClient, cached, remove } = await renderMutations();
    const pendingDelete = createPendingResponse(ok({ message: '삭제' }));
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

  it('결과가 없는 옛 서버면 삭제만 알리고 개수는 목록 값으로 남긴다', async () => {
    // Given
    const { httpClient, analytics, remove } = await renderMutations();
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: '삭제' } });

    // When
    await remove(1, { todoHandling: null, moveToCategoryId: 2 });

    // Then
    expect(await screen.findAllByText('카테고리를 삭제했어요')).not.toHaveLength(0);
    expect(analytics.trackEvent).toHaveBeenCalledWith('category_deleted', {
      todo_handling: 'move',
      todo_count_bucket: '1_9',
    });
  });
});
