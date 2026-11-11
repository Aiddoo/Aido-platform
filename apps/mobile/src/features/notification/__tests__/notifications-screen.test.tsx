import type { NotificationInboxItem } from '@aido/api';
import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import NotificationsScreen from '../../../../app/(app)/notifications/index';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { createNotificationInboxResponseDto } from './notification.fixtures';

async function renderNotificationsCategory(category: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ category });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 1);

  await renderScreen(<NotificationsScreen />, { queryClient, di: { httpClient } });
}

describe('알림 화면의 안 읽은 알림 줄', () => {
  it('안 읽은 수는 모든 분류를 합친 값이라 전체 탭에서 보인다', async () => {
    // When
    await renderNotificationsCategory(NOTIFICATION_CATEGORY.ALL);

    // Then
    expect(await screen.findByText('읽지 않은 알림')).toBeOnTheScreen();
    expect(screen.getByText('1건')).toBeOnTheScreen();
  });

  it.each([NOTIFICATION_CATEGORY.NOTICE, NOTIFICATION_CATEGORY.TODO, NOTIFICATION_CATEGORY.SOCIAL])(
    '%s 탭에서는 다른 분류의 안 읽은 수를 보이지 않는다',
    async (category) => {
      // When
      await renderNotificationsCategory(category);

      // Then
      expect(screen.queryByText('읽지 않은 알림')).toBeNull();
    },
  );
});

describe('알림함 항목을 누르면', () => {
  const INBOX_ITEM: NotificationInboxItem = {
    id: 1,
    userId: 'user-1',
    type: 'WEATHER_MORNING',
    title: '오늘은 비 소식이 있어요',
    body: '우산을 챙겨요',
    isRead: true,
    metadata: null,
    action: { type: 'DEEP_LINK' },
    createdAt: '2026-03-08T10:00:00.000Z',
    readAt: '2026-03-08T10:05:00.000Z',
  };

  async function renderInbox(item: NotificationInboxItem) {
    jest.mocked(useLocalSearchParams).mockReturnValue({ category: NOTIFICATION_CATEGORY.ALL });
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(async (path) =>
      path === 'v1/notifications/inbox'
        ? ok(createNotificationInboxResponseDto([item]))
        : new Promise(() => undefined),
    );
    await renderScreen(<NotificationsScreen />, {
      withLocalDate: true,
      withOverlay: true,
      di: { httpClient },
    });
  }

  it('서버가 고른 navigation으로 간다', async () => {
    // Given
    await renderInbox({
      ...INBOX_ITEM,
      navigation: { kind: 'WEATHER_RESCHEDULE', todoIds: [3, 4], reason: 'rain' },
    });

    // When
    await fireEvent.press(await screen.findByTestId('notification-item-WEATHER_MORNING'));

    // Then
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/weather/reschedule',
      params: { todoIds: '3,4', reason: 'rain' },
    });
  });

  it('서버가 navigation을 싣지 못한 항목은 알림함에 머문다', async () => {
    // Given
    await renderInbox(INBOX_ITEM);

    // When
    await fireEvent.press(await screen.findByTestId('notification-item-WEATHER_MORNING'));

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
