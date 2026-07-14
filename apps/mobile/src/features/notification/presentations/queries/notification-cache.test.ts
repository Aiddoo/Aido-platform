import type { InfiniteData } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { NotificationListResult } from '../../models/notification.model';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';
import {
  optimisticallyMarkNotificationsRead,
  restoreNotificationCache,
} from './notification-cache';

const makePage = (id: number): NotificationListResult => ({
  notifications: [
    {
      id,
      userId: 'user-1',
      type: 'SYSTEM_NOTICE',
      title: 'title',
      body: 'body',
      isRead: false,
      metadata: null,
      createdAt: new Date('2026-07-14T00:00:00.000Z'),
      readAt: null,
    },
  ],
  unreadCount: 2,
  hasMore: false,
  nextCursor: null,
});

const makeData = (...ids: number[]): InfiniteData<NotificationListResult> => ({
  pages: ids.map(makePage),
  pageParams: ids.map((_, index) => (index === 0 ? undefined : index)),
});

describe('notification cache optimistic update', () => {
  test('모든 필터와 infinite page를 즉시 읽음 처리하고 롤백한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    const client = new QueryClient();
    const allKey = NOTIFICATION_QUERY_KEYS.list({});
    const unreadKey = NOTIFICATION_QUERY_KEYS.list({ unreadOnly: true });
    const data = makeData(1, 2);
    client.setQueryData(allKey, data);
    client.setQueryData(unreadKey, data);
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 2);

    const snapshot = await optimisticallyMarkNotificationsRead(client);

    const updatedAll = client.getQueryData<InfiniteData<NotificationListResult>>(allKey);
    const updatedUnread = client.getQueryData<InfiniteData<NotificationListResult>>(unreadKey);
    expect(
      updatedAll?.pages.flatMap((page) => page.notifications).every((item) => item.isRead),
    ).toBe(true);
    expect(updatedUnread?.pages.flatMap((page) => page.notifications)).toEqual([]);
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(0);

    restoreNotificationCache(client, snapshot);
    expect(client.getQueryData<InfiniteData<NotificationListResult>>(allKey)).toEqual(data);
    client.clear();
    jest.useRealTimers();
  });

  test('단일 미읽음 알림은 모든 필터에서 한 번만 감소하고 unread 목록에서 제거한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    const client = new QueryClient();
    const allKey = NOTIFICATION_QUERY_KEYS.list({});
    const unreadKey = NOTIFICATION_QUERY_KEYS.list({ unreadOnly: true });
    client.setQueryData(allKey, makeData(1, 2));
    client.setQueryData(unreadKey, makeData(1, 2));
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 2);

    await optimisticallyMarkNotificationsRead(client, 1);

    const all = client.getQueryData<InfiniteData<NotificationListResult>>(allKey);
    const unread = client.getQueryData<InfiniteData<NotificationListResult>>(unreadKey);
    expect(
      all?.pages.flatMap((page) => page.notifications).find((item) => item.id === 1)?.isRead,
    ).toBe(true);
    expect(unread?.pages.flatMap((page) => page.notifications).map((item) => item.id)).toEqual([2]);
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(1);
    client.clear();
    jest.useRealTimers();
  });

  test('캐시에 이미 읽은 알림을 다시 처리해도 unread count를 중복 감소시키지 않는다', async () => {
    const client = new QueryClient();
    const allKey = NOTIFICATION_QUERY_KEYS.list({});
    const page = makePage(1);
    const data: InfiniteData<NotificationListResult> = {
      pages: [
        {
          ...page,
          notifications: page.notifications.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: new Date('2026-07-14T01:00:00.000Z'),
          })),
        },
      ],
      pageParams: [undefined],
    };
    client.setQueryData(allKey, data);
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 1);

    await optimisticallyMarkNotificationsRead(client, 1);

    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(1);
    client.clear();
  });
});
