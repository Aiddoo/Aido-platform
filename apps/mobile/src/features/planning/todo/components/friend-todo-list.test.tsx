import '@src/shared/i18n/init';
import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { QueryErrorBoundary } from '@src/shared/ui';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { stubWindowDimensions } from '@src/testing/window-dimensions';
import { fireEvent, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { Suspense } from 'react';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TODO_QUERY_KEYS } from '../queries/todo-query-keys';
import { FriendCalendar } from './calendar/friend-calendar';
import { FriendTodoList } from './friend-todo-list';

const FRIEND_ID = 'cmfriend000000000000000001';
const CALENDAR_RETRY_LABEL = '캘린더 표시를 업데이트하지 못했어요';

describe('FriendTodoList', () => {
  it('보던 친구가 친구를 끊어 403 FOLLOW_0906이 오면 오류로 보고하지 않고 볼 수 없다는 안내와 내 피드로 가는 길만 보인다', async () => {
    // Given
    // React가 경계에 잡힌 렌더 오류를 console.error로 한 번 더 찍는 것을 막는다
    jest.spyOn(console, 'error').mockImplementation(noop);
    createRouteParamsFake({ friendId: FRIEND_ID });
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(async (path: string) =>
      path === 'v1/auth/preference'
        ? ok(createPreferenceDto())
        : err(new ApiError(ErrorCode.FOLLOW_0906, '친구가 아니에요', HttpStatus.FORBIDDEN)),
    );
    const errorReporter = createErrorReporterStub();

    // When
    await renderScreen(
      <>
        <FriendCalendar friendId={FRIEND_ID} />
        <QueryErrorBoundary fallback={FriendTodoList.Error}>
          <Suspense fallback={<FriendTodoList.Loading />}>
            <FriendTodoList
              friendId={FRIEND_ID}
              renderRowAction={() => null}
              getMenuAction={() => null}
              emptyAction={null}
            />
          </Suspense>
        </QueryErrorBoundary>
      </>,
      { di: createTestDi({ ports: { httpClient, errorReporter } }), withLocalDate: true },
    );
    await screen.findByTestId('friend-feed-unavailable');
    await fireEvent.press(screen.getByText('내 피드로 가기'));

    // Then
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(errorReporter.captureMessage).not.toHaveBeenCalled();
    expect(screen.queryByText(CALENDAR_RETRY_LABEL)).toBeNull();
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ friendId: undefined }));
  });

  it('하위 항목이 없는 행을 연달아 눌러도 상세를 한 번만 연다', async () => {
    // Given
    stubWindowDimensions(390);
    const date = createDateKey('2026-03-08');
    createRouteParamsFake({ friendId: FRIEND_ID, date });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createPreferenceDto()));
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(TODO_QUERY_KEYS.friendListByDate({ userId: FRIEND_ID, date }), {
      todos: [createParentTodo({ id: 7, title: '친구 할 일', startDate: date, subTodos: [] })],
      hasNext: false,
      nextCursor: null,
    });
    await renderScreen(
      <Suspense fallback={null}>
        <FriendTodoList
          friendId={FRIEND_ID}
          renderRowAction={() => null}
          getMenuAction={() => null}
          emptyAction={null}
        />
      </Suspense>,
      { di: createTestDi({ ports: { httpClient, queryClient } }), withLocalDate: true },
    );
    const row = await screen.findByText('친구 할 일');

    // When
    await fireEvent.press(row);
    await fireEvent.press(row);

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: 7 },
    });
  });
});
