import type { NotificationInboxItem } from '@aido/api';
import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createTestQueryClient, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { stubWindowDimensions } from '@src/testing/window-dimensions';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import NotificationsScreen from '../../../../app/(app)/notifications/index';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { createNotificationInboxResponseDto } from './notification.fixtures';

const COMPACT_WIDTH = 390;
const EXPANDED_WIDTH = 1024;

async function renderNotificationsCategory(category: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ category });
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 1);

  await renderScreen(<NotificationsScreen />, {
    di: createTestDi({ ports: { httpClient, queryClient } }),
  });
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
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
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

  it('미리보기를 붙인 행을 두 번 빠르게 눌러도 목적지를 한 번만 연다', async () => {
    // Given
    stubWindowDimensions(COMPACT_WIDTH);
    await renderInbox({ ...INBOX_ITEM, navigation: { kind: 'TODO', todoId: 42 } });
    const item = await screen.findByTestId('notification-item-WEATHER_MORNING');

    // When
    await fireEvent.press(item);
    await fireEvent.press(item);

    // Then
    expect(screen.getByTestId('link-preview')).toBeOnTheScreen();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: 42 },
    });
  });

  it.each([
    [
      '읽은 알림이 같은 루트 Stack의 할 일 상세로 가면 미리본다',
      true,
      { kind: 'TODO', todoId: 42 },
      COMPACT_WIDTH,
      1,
    ],
    [
      '안 읽은 알림은 미리보기로 열면 읽음이 빠져 탭으로만 연다',
      false,
      { kind: 'TODO', todoId: 42 },
      COMPACT_WIDTH,
      0,
    ],
    ['탭 안 화면(성과)은 미리보지 않는다', true, { kind: 'ACHIEVEMENTS' }, COMPACT_WIDTH, 0],
    [
      '넓은 화면은 pane을 고르는 탭으로만 연다',
      true,
      { kind: 'TODO', todoId: 42 },
      EXPANDED_WIDTH,
      0,
    ],
  ] as const)('%s', async (_case, isRead, navigation, width, previewCount) => {
    // Given
    stubWindowDimensions(width);

    // When
    await renderInbox({
      ...INBOX_ITEM,
      isRead,
      readAt: isRead ? INBOX_ITEM.readAt : null,
      navigation,
    });
    await screen.findByTestId('notification-item-WEATHER_MORNING');

    // Then
    expect(screen.queryAllByTestId('link-preview')).toHaveLength(previewCount);
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

describe('받은 응원 알림', () => {
  const SENDER_ID = 'cmsender0000000000000001';
  const CHEER_ITEM: NotificationInboxItem = {
    id: 2,
    userId: 'user-1',
    type: 'CHEER_RECEIVED',
    title: '응원이 도착했어요',
    body: '오늘도 화이팅!',
    isRead: true,
    metadata: { senderId: SENDER_ID, senderName: '지윤' },
    context: { cheerId: 7, friendId: SENDER_ID },
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'CHEER', cheerId: 7, friendId: SENDER_ID },
    createdAt: '2026-03-08T10:00:00.000Z',
    readAt: '2026-03-08T10:05:00.000Z',
  };
  const REPORT_ROUTE = {
    pathname: '/users/[userId]/report',
    params: { userId: SENDER_ID, name: '지윤', targetType: 'CHEER_MESSAGE', targetId: '7' },
  };

  async function renderCheer() {
    jest.mocked(useLocalSearchParams).mockReturnValue({ category: NOTIFICATION_CATEGORY.ALL });
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(async (path) =>
      path === 'v1/notifications/inbox'
        ? ok(createNotificationInboxResponseDto([CHEER_ITEM]))
        : new Promise(() => undefined),
    );
    await renderScreen(<NotificationsScreen />, {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
    });
    return screen.findByTestId('notification-item-CHEER_RECEIVED');
  }

  it('피드 탭으로 가는 응원은 미리보기 없이 행을 길게 눌러 신고한다', async () => {
    // Given
    stubWindowDimensions(COMPACT_WIDTH);
    const item = await renderCheer();

    // When
    await fireEvent(item, 'longPress');

    // Then
    expect(screen.queryByTestId('link-preview')).toBeNull();
    expect(router.push).toHaveBeenCalledWith(REPORT_ROUTE);
  });
});
