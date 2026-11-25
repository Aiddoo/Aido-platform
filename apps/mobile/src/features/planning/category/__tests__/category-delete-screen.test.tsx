import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TodoCategoryDeleteSheetRoute from '../../../../../app/(app)/todo-categories/[categoryId]/delete';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import {
  createTodoCategoryDeletionPreviewDto,
  createTodoCategoryListDto,
  createTodoCategoryWithCount,
  createTodoCategoryWithCountDto,
} from './todo-category.fixtures';

const PERSONAL = createTodoCategoryWithCount({ id: 1, name: '개인', sortOrder: 0 });
const WORKOUT = createTodoCategoryWithCount({ id: 3, name: '운동', sortOrder: 1, todoCount: 12 });
const STUDY = createTodoCategoryWithCount({ id: 2, name: '공부', sortOrder: 2 });
const CATEGORIES = [PERSONAL, WORKOUT, STUDY];

async function renderDeleteRoute() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url) =>
    url.endsWith('/deletion-preview')
      ? ok(createTodoCategoryDeletionPreviewDto({ categoryId: WORKOUT.id }))
      : ok(
          createTodoCategoryListDto({
            items: CATEGORIES.map((category) => createTodoCategoryWithCountDto(category)),
          }),
        ),
  );
  httpClient.delete.mockResolvedValue(
    ok({
      message: '삭제',
      result: { todoHandling: 'move', todoCount: 12, seriesCount: 2, moveToCategoryId: 2 },
    }),
  );
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), { categories: CATEGORIES });
  jest.mocked(useLocalSearchParams).mockReturnValue({ categoryId: String(WORKOUT.id) });

  const analytics = createAnalyticsStub();

  await renderScreen(<TodoCategoryDeleteSheetRoute />, {
    di: createTestDi({ ports: { httpClient, queryClient, analytics } }),
  });
  await layoutSheetRoute();
  await screen.findByTestId('category-delete-sheet');

  return { httpClient, analytics };
}

describe('TodoCategoryDeleteSheetRoute', () => {
  it('옮길 곳 시트에서 다른 카테고리를 고르면 그곳으로 할 일을 옮기고 한 번 지워 한 번 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { httpClient, analytics } = await renderDeleteRoute();

    // When
    await user.press(screen.getByRole('button', { name: '옮길 카테고리: 개인' }));
    await user.press(await screen.findByRole('radio', { name: '공부' }));
    await user.press(screen.getByTestId('category-select-submit'));
    await screen.findByRole('button', { name: '옮길 카테고리: 공부' });
    await user.press(screen.getByTestId('category-delete-submit'));

    // Then
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
      params: { todoHandling: 'move', moveToCategoryId: STUDY.id },
    });
    await waitFor(() =>
      expect(
        analytics.trackEvent.mock.calls.filter(([name]) => name === 'category_deleted'),
      ).toHaveLength(1),
    );
  });

  it('함께 지우기를 고르면 옮길 곳 없이 할 일까지 지운다', async () => {
    // Given
    const user = userEvent.setup();
    const { httpClient } = await renderDeleteRoute();

    // When
    await user.press(screen.getByTestId('category-delete-handling-delete'));
    await user.press(screen.getByTestId('category-delete-submit'));

    // Then
    await waitFor(() => expect(httpClient.delete).toHaveBeenCalledTimes(1));
    expect(httpClient.delete).toHaveBeenCalledWith('v1/todo-categories/3', {
      params: { todoHandling: 'delete' },
    });
  });
});
