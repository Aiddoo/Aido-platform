import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TodoCategoryEditSheetRoute from '../../../../../app/(app)/todo-categories/[categoryId]/edit';
import { CATEGORY_COLORS } from '../constants/todo-category.constants';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { createTodoCategoryDto, createTodoCategoryWithCount } from './todo-category.fixtures';

const CATEGORY_ID = 3;

async function renderEditRoute() {
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue(
    ok({ message: 'ok', category: createTodoCategoryDto({ id: CATEGORY_ID, name: '운동' }) }),
  );
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [
      createTodoCategoryWithCount({ id: CATEGORY_ID, name: '운동', color: CATEGORY_COLORS[0] }),
    ],
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ categoryId: String(CATEGORY_ID) });

  const analytics = createAnalyticsStub();

  await renderScreen(<TodoCategoryEditSheetRoute />, {
    di: createTestDi({ ports: { httpClient, queryClient, analytics } }),
  });
  await layoutSheetRoute();
  await screen.findByDisplayValue('운동');

  return { httpClient, analytics };
}

describe('TodoCategoryEditSheetRoute', () => {
  setupFakeTimersPerTest();

  it('이름과 색을 고쳐 확인을 두 번 눌러도 고친 이름과 색으로 한 번 보내고 한 번 남긴다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient, analytics } = await renderEditRoute();
    await user.clear(screen.getByDisplayValue('운동'));
    await user.type(screen.getByPlaceholderText('카테고리 이름을 입력해주세요'), '헬스');
    await user.press(
      screen.getByRole('radio', { name: `색상 5/${String(CATEGORY_COLORS.length)}` }),
    );

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(httpClient.patch).toHaveBeenCalledWith(`v1/todo-categories/${String(CATEGORY_ID)}`, {
      name: '헬스',
      color: CATEGORY_COLORS[4],
    });
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'category_updated'),
    ).toHaveLength(1);
  });

  it('바꾸지 않고 확인하면 요청을 보내지 않는다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient } = await renderEditRoute();

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});
