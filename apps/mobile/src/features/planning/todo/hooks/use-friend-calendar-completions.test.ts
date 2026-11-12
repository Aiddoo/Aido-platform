import { ErrorCode } from '@aido/api/errors';
import { err } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { createHttpClientStub, createTestQueryClient, createTestDi } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { waitFor } from '@testing-library/react-native';

import { createTodoApiError } from '../__tests__/todo.fixtures';
import { useFriendCalendarCompletions } from './use-friend-calendar-completions';

/** 앱 QueryClient처럼 받은 값을 5분 동안 새것으로 본다 */
function createAppLikeQueryClient() {
  return createTestQueryClient({ defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } } });
}

describe('useFriendCalendarCompletions', () => {
  it('볼 수 없는 친구면 고른 달 하나만 실패하고 앞뒤 달은 묻지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(
      err(createTodoApiError({ code: ErrorCode.FOLLOW_0906, status: 403 })),
    );

    // When
    const { result } = await renderScreenHook(
      () =>
        useFriendCalendarCompletions({
          friendUserId: 'friend-1',
          dateKey: createDateKey('2026-03-10'),
        }),
      { di: createTestDi({ ports: { httpClient, queryClient: createAppLikeQueryClient() } }) },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Then
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
});
