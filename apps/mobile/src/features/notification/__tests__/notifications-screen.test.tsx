import {
  type NotificationInboxItem,
  notificationInboxResponseSchema,
} from '@aido/api/contracts/notification/v1';
import { NOTIFICATION_CATEGORY } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { countGetRequests } from '@src/features/planning/todo/__tests__/todo.test-utils';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { stubWindowDimensions } from '@src/testing/window-dimensions';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import NotificationsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/notifications/index';
import {
  createMarkReadResponseDto,
  createNotificationInboxResponseDto,
} from './notification.fixtures';

const COMPACT_WIDTH = 390;
const EXPANDED_WIDTH = 1024;

describe('NotificationsScreen', () => {
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

  describe('알림함 목록', () => {
    const INBOX_PATH = 'v1/notifications/inbox';
    const UNREAD_COUNT_PATH = 'v1/notifications/inbox/unread-count';
    const READ_ALL_PATH = 'v1/notifications/inbox/read-all';

    function createInboxItem(
      id: number,
      overrides: Partial<NotificationInboxItem> = {},
    ): NotificationInboxItem {
      return {
        id,
        userId: 'user-1',
        type: 'SYSTEM_NOTICE',
        title: `알림 ${id}`,
        body: `본문 ${id}`,
        isRead: false,
        metadata: null,
        action: { type: 'DEEP_LINK' },
        navigation: { kind: 'ACHIEVEMENTS' },
        createdAt: new Date().toISOString(),
        readAt: null,
        ...overrides,
      };
    }

    /** 읽음 처리를 기억하는 서버. 다시 받으면 읽은 알림과 줄어든 수를 준다 */
    function createInboxServer(
      pages: NotificationInboxItem[][],
      { inboxFailures = 0 }: { inboxFailures?: number } = {},
    ) {
      let remainingInboxFailures = inboxFailures;
      const readIds = new Set<number>();
      const allItems = pages.flat();
      const httpClient = createHttpClientStub();
      const toItem = (item: NotificationInboxItem) =>
        readIds.has(item.id) ? { ...item, isRead: true, readAt: item.createdAt } : item;
      const countUnread = () => allItems.filter((item) => !toItem(item).isRead).length;
      httpClient.get.mockImplementation(async (path, options) => {
        if (path === UNREAD_COUNT_PATH) {
          return ok({ unreadCount: countUnread() });
        }
        if (path !== INBOX_PATH) {
          return new Promise(() => undefined);
        }
        if (remainingInboxFailures > 0) {
          remainingInboxFailures -= 1;
          throw new NetworkError();
        }
        const pageIndex = options?.params?.cursor == null ? 0 : Number(options.params.cursor);
        const page = pages[pageIndex] ?? [];
        const hasMore = pageIndex + 1 < pages.length;
        return ok(
          notificationInboxResponseSchema.parse({
            notifications: page.map(toItem),
            unreadCount: countUnread(),
            hasMore,
            nextCursor: hasMore ? pageIndex + 1 : null,
          }),
        );
      });
      httpClient.patch.mockImplementation(async (path) => {
        const readCount = path === READ_ALL_PATH ? countUnread() : 1;
        if (path === READ_ALL_PATH) {
          for (const item of allItems) {
            readIds.add(item.id);
          }
        } else {
          readIds.add(Number(path.split('/')[2]));
        }
        return ok(createMarkReadResponseDto({ readCount }));
      });
      return httpClient;
    }

    async function renderList(httpClient: ReturnType<typeof createHttpClientStub>) {
      jest.mocked(useLocalSearchParams).mockReturnValue({ category: NOTIFICATION_CATEGORY.ALL });
      await renderScreen(<NotificationsScreen />, {
        di: createTestDi({ ports: { httpClient } }),
        withLocalDate: true,
        withOverlay: true,
      });
    }

    it('처음 열면 목록과 안 읽은 수를 한 번씩만 받는다', async () => {
      // Given
      const httpClient = createInboxServer([[createInboxItem(1), createInboxItem(2)]]);

      // When
      await renderList(httpClient);
      await screen.findByText('알림 1');

      // Then
      expect(await screen.findByText('2건')).toBeOnTheScreen();
      const counts = countGetRequests(httpClient);
      expect(counts[INBOX_PATH]).toBe(1);
      expect(counts[UNREAD_COUNT_PATH]).toBe(1);
    });

    it('목록 끝에 닿으면 다음 쪽을 이어 받아 앞 쪽 아래에 붙인다', async () => {
      // Given
      const httpClient = createInboxServer([[createInboxItem(1)], [createInboxItem(2)]]);
      await renderList(httpClient);
      const firstItem = await screen.findByText('알림 1');

      // When
      await fireEvent(firstItem, 'endReached');

      // Then
      expect(await screen.findByText('알림 2')).toBeOnTheScreen();
      expect(screen.getByText('알림 1')).toBeOnTheScreen();
      expect(httpClient.get).toHaveBeenCalledWith(
        INBOX_PATH,
        expect.objectContaining({ params: expect.objectContaining({ cursor: 1 }) }),
      );
      expect(countGetRequests(httpClient)[INBOX_PATH]).toBe(2);
    });

    it('오늘 받은 알림과 오래전에 받은 알림을 날짜 묶음으로 나눠 보인다', async () => {
      // Given
      const httpClient = createInboxServer([
        [
          createInboxItem(1, { title: '오늘 받은 알림' }),
          createInboxItem(2, { title: '오래된 알림', createdAt: '2020-01-15T03:00:00.000Z' }),
        ],
      ]);

      // When
      await renderList(httpClient);

      // Then
      expect(await screen.findByText('오늘 받은 알림')).toBeOnTheScreen();
      expect(screen.getByText('오늘')).toBeOnTheScreen();
      expect(screen.getByText('이전')).toBeOnTheScreen();
      expect(screen.getByText('오래된 알림')).toBeOnTheScreen();
    });

    it('안 읽은 알림을 누르면 그 알림만 읽고 안 읽은 수를 줄인 뒤 목적지로 간다', async () => {
      // Given
      const httpClient = createInboxServer([[createInboxItem(1), createInboxItem(2)]]);
      await renderList(httpClient);
      await screen.findByText('2건');

      // When
      await fireEvent.press(screen.getByText('알림 1'));

      // Then
      expect(await screen.findByText('1건')).toBeOnTheScreen();
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledWith('v1/notifications/1/read');
      expect(router.navigate).toHaveBeenCalledWith('/achievements');
    });

    it('모두 읽음을 누르면 한 번 요청하고 안 읽은 수 줄이 사라진다', async () => {
      // Given
      const httpClient = createInboxServer([[createInboxItem(1), createInboxItem(2)]]);
      await renderList(httpClient);
      await screen.findByText('2건');

      // When
      await fireEvent.press(screen.getByText('모두 읽음'));

      // Then
      await waitFor(() => expect(screen.queryByText('2건')).toBeNull());
      expect(screen.queryByText('모두 읽음')).toBeNull();
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
      expect(httpClient.patch).toHaveBeenCalledWith(READ_ALL_PATH);
    });

    it('받은 알림이 없으면 빈 안내를 보이고 안 읽은 수 줄은 그리지 않는다', async () => {
      // Given
      const httpClient = createInboxServer([[]]);

      // When
      await renderList(httpClient);

      // Then
      expect(await screen.findByText('아직 알림이 없어요')).toBeOnTheScreen();
      await waitFor(() => expect(countGetRequests(httpClient)[UNREAD_COUNT_PATH]).toBe(1));
      expect(screen.queryByText('모두 읽음')).toBeNull();
    });

    it('목록을 받지 못하면 오류를 보이고 다시 시도하면 받아 보인다', async () => {
      // Given
      const httpClient = createInboxServer([[createInboxItem(1)]], { inboxFailures: 1 });
      await renderList(httpClient);
      expect(await screen.findByText('알림을 불러오지 못했어요')).toBeOnTheScreen();

      // When
      await fireEvent.press(screen.getByText('다시 시도'));

      // Then
      expect(await screen.findByText('알림 1')).toBeOnTheScreen();
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
});
