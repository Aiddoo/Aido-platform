import '@src/shared/i18n/init';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { toTodo } from '@src/features/planning/todo/apis/todo.mapper';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { readDeviceLocalDateState } from '@src/shared/date/local-date-clock';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import type { PushPermission } from '../domains/push-permission.model';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { PushPermissionNotice } from './push-permission-notice';

const DENIED_TITLE = '알림이 꺼져 있어요';

async function renderCard(
  permission: PushPermission,
  { hasUpcomingTimedTodo = true }: { hasUpcomingTimedTodo?: boolean } = {},
) {
  const syncStorage = createMemoryObservableSyncStorage();
  const externalLink = createExternalLinkGatewayStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  const todayKey = readDeviceLocalDateState().currentLocalDateKey;
  queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(createCurrentUserDto()));
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), toPreference(createPreferenceDto()));
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), permission);
  // 내일 시작하는 시간 할 일은 지금 몇 시든 아직 알림이 남은 할 일이다
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: todayKey }), {
    todos: hasUpcomingTimedTodo
      ? [
          toTodo(
            createTodoDto({
              startDate: addDaysToDateKey(todayKey, 1),
              isAllDay: false,
              scheduledLocalTime: '09:00',
            }),
          ),
        ]
      : [],
    hasNext: false,
    nextCursor: null,
  });

  await renderScreen(<PushPermissionNotice />, {
    di: {
      httpClient: createHttpClientStub(),
      syncStorage,
      pushNotification: createPushNotificationGatewayStub(),
      analytics: createAnalyticsStub(),
      logger: createLoggerStub(),
      externalLink,
    },
    queryClient,
    withLocalDate: true,
  });
  return { externalLink };
}

describe('PushPermissionNotice — 피드 알림 꺼짐 안내', () => {
  it('거절했고 알림이 갈 할 일이 있으면 기기 설정을 열게 한다', async () => {
    // Given
    const user = userEvent.setup();
    const { externalLink } = await renderCard({ status: 'DENIED', canAskAgain: false });

    // When
    await user.press(screen.getByRole('button', { name: '설정 열기' }));

    // Then
    expect(screen.getByText(DENIED_TITLE)).toBeTruthy();
    await waitFor(() => expect(externalLink.openSettings).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['알림이 갈 할 일이 없으면', { status: 'DENIED', canAskAgain: false }, false],
    ['아직 묻지 않았으면', { status: 'NOT_DETERMINED', canAskAgain: true }, true],
    ['허용했으면', { status: 'GRANTED', canAskAgain: false }, true],
  ] as const)('%s 보이지 않는다', async (_label, permission, hasUpcomingTimedTodo) => {
    // When
    await renderCard(permission, { hasUpcomingTimedTodo });

    // Then
    expect(screen.queryByText(DENIED_TITLE)).toBeNull();
  });

  it('닫으면 숨긴다', async () => {
    // Given
    const user = userEvent.setup();
    await renderCard({ status: 'DENIED', canAskAgain: false });

    // When
    await user.press(screen.getByLabelText('알림 안내 닫기'));

    // Then
    await waitFor(() => expect(screen.queryByText(DENIED_TITLE)).toBeNull());
  });
});
