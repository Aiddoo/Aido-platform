import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
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

import TodoCategoryCreateSheetRoute from '../../../../../app/(app)/todo-categories/new';
import { CATEGORY_COLORS } from '../constants/todo-category.constants';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import {
  createTodoCategoryApiError,
  createTodoCategoryDto,
  createTodoCategoryWithCount,
} from './todo-category.fixtures';

const NAME_PLACEHOLDER = '카테고리 이름을 입력해주세요';

async function renderCreateRoute() {
  const httpClient = createHttpClientStub();
  httpClient.post.mockResolvedValue(
    ok({ message: 'ok', category: createTodoCategoryDto({ id: 2, name: '운동' }) }),
  );
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [createTodoCategoryWithCount({ id: 1, name: '할 일' })],
  });

  const analytics = createAnalyticsStub();

  await renderScreen(<TodoCategoryCreateSheetRoute />, {
    withLocalDate: true,
    di: createTestDi({ ports: { httpClient, queryClient, analytics } }),
  });
  await layoutSheetRoute();

  return { httpClient, analytics };
}

describe('TodoCategoryCreateSheetRoute', () => {
  setupFakeTimersPerTest();

  it('이름을 적고 색을 고른 뒤 확인하면 그 이름과 색으로 한 번 만들고 한 번 남긴다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient, analytics } = await renderCreateRoute();
    await user.type(await screen.findByPlaceholderText(NAME_PLACEHOLDER), '운동');
    await user.press(
      screen.getByRole('radio', { name: `색상 3/${String(CATEGORY_COLORS.length)}` }),
    );

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(httpClient.post).toHaveBeenCalledWith('v1/todo-categories', {
      name: '운동',
      color: CATEGORY_COLORS[2],
    });
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'category_created'),
    ).toHaveLength(1);
  });

  it('이름을 비운 채 확인하면 요청 없이 이름 칸에 안내가 보인다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient } = await renderCreateRoute();
    await screen.findByPlaceholderText(NAME_PLACEHOLDER);

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(await screen.findByText('카테고리 이름을 입력해주세요')).toBeOnTheScreen();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('같은 이름이 있어 거절되면 안내하고 시트와 적은 이름이 남아 고쳐 다시 보낼 수 있다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { httpClient } = await renderCreateRoute();
    httpClient.post.mockResolvedValueOnce(
      fail(
        createTodoCategoryApiError({
          code: ErrorCode.TODO_CATEGORY_0853,
          message: '같은 이름의 카테고리가 있어요',
          status: 409,
        }),
      ),
    );
    const input = await screen.findByPlaceholderText(NAME_PLACEHOLDER);
    await user.type(input, '할 일');

    // When
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    expect(await screen.findAllByText('같은 이름의 카테고리가 있어요')).not.toHaveLength(0);
    expect(screen.getByPlaceholderText(NAME_PLACEHOLDER)).toHaveDisplayValue('할 일');

    // When
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    await user.type(screen.getByPlaceholderText(NAME_PLACEHOLDER), '2');
    await user.press(screen.getByRole('button', { name: '확인' }));

    // Then
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(2));
    expect(httpClient.post.mock.calls[1]?.[1]).toMatchObject({ name: '할 일2' });
  });
});
