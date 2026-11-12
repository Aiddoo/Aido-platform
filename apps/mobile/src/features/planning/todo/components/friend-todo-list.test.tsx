import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { QueryErrorBoundary } from '@src/shared/ui';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { Suspense } from 'react';

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
        : err(new ApiError(ErrorCode.FOLLOW_0906, '친구가 아니에요', 403)),
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
});
