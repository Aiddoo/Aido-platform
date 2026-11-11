import { toInstant } from '@src/shared/date/instant';
import { createTestQueryClient } from '@src/testing/core';
import type { InfiniteData } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import type { NotificationPage } from '../domains/notification.model';
import { optimisticallyMarkNotificationsRead, revertNotificationsRead } from './notification-cache';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';

const makePage = (id: number): NotificationPage => ({
  items: [
    {
      id,
      userId: 'user-1',
      type: 'SYSTEM_NOTICE',
      title: 'title',
      body: 'body',
      isRead: false,
      createdAt: toInstant('2026-07-14T00:00:00.000Z'),
      readAt: null,
    },
  ],
  nextCursor: null,
});

const makeData = (...ids: number[]): InfiniteData<NotificationPage, number | undefined> => ({
  pages: ids.map(makePage),
  pageParams: ids.map((_, index) => (index === 0 ? undefined : index)),
});

describe('notification cache optimistic update', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
  });

  afterEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useRealTimers();
  });

  it('모든 필터와 infinite page를 즉시 읽음 처리하고 롤백한다', async () => {
    // Given
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    const allKey = NOTIFICATION_QUERY_KEYS.list({ limit: 20 });
    const categoryKey = NOTIFICATION_QUERY_KEYS.list({ category: 'SOCIAL', limit: 20 });
    const data = makeData(1, 2);
    client.setQueryData(allKey, data);
    client.setQueryData(categoryKey, data);
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 2);

    // When
    const change = await optimisticallyMarkNotificationsRead(client);
    const updatedAll =
      client.getQueryData<InfiniteData<NotificationPage, number | undefined>>(allKey);
    const updatedCategory =
      client.getQueryData<InfiniteData<NotificationPage, number | undefined>>(categoryKey);
    const updatedCategoryCount = client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount());
    if (change != null) {
      revertNotificationsRead(client, change);
    }

    // Then
    expect(updatedAll?.pages.flatMap((page) => page.items).every((item) => item.isRead)).toBe(true);
    expect(updatedCategory?.pages.flatMap((page) => page.items).every((item) => item.isRead)).toBe(
      true,
    );
    expect(updatedCategoryCount).toBe(0);
    expect(client.getQueryData<InfiniteData<NotificationPage, number | undefined>>(allKey)).toEqual(
      data,
    );
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(2);
  });

  it('단일 미읽음 알림은 모든 필터에서 한 번만 감소한다', async () => {
    // Given
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    const allKey = NOTIFICATION_QUERY_KEYS.list({ limit: 20 });
    const categoryKey = NOTIFICATION_QUERY_KEYS.list({ category: 'SOCIAL', limit: 20 });
    client.setQueryData(allKey, makeData(1, 2));
    client.setQueryData(categoryKey, makeData(1, 2));
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 2);

    // When
    await optimisticallyMarkNotificationsRead(client, 1);

    // Then
    const all = client.getQueryData<InfiniteData<NotificationPage, number | undefined>>(allKey);
    const category =
      client.getQueryData<InfiniteData<NotificationPage, number | undefined>>(categoryKey);
    expect(all?.pages.flatMap((page) => page.items).find((item) => item.id === 1)?.isRead).toBe(
      true,
    );
    expect(
      category?.pages.flatMap((page) => page.items).find((item) => item.id === 1)?.isRead,
    ).toBe(true);
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(1);
  });

  it('캐시에 이미 읽은 알림을 다시 처리해도 unread count를 중복 감소시키지 않는다', async () => {
    // Given
    const allKey = NOTIFICATION_QUERY_KEYS.list({ limit: 20 });
    const page = makePage(1);
    const data: InfiniteData<NotificationPage, number | undefined> = {
      pages: [
        {
          ...page,
          items: page.items.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: toInstant('2026-07-14T01:00:00.000Z'),
          })),
        },
      ],
      pageParams: [undefined],
    };
    client.setQueryData(allKey, data);
    client.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 1);

    // When
    await optimisticallyMarkNotificationsRead(client, 1);

    // Then
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBe(1);
  });

  it('읽지 않은 수를 모르면 한 건을 읽어도 수를 0으로 만들지 않는다', async () => {
    // Given
    client.setQueryData(NOTIFICATION_QUERY_KEYS.list({ limit: 20 }), makeData(1, 2));

    // When
    await optimisticallyMarkNotificationsRead(client, 1);

    // Then
    expect(client.getQueryData(NOTIFICATION_QUERY_KEYS.unreadCount())).toBeUndefined();
  });

  it('조회 취소를 기다리는 동안 계정이 바뀌면 새 계정 캐시를 수정하지 않는다', async () => {
    // Given
    const listKey = NOTIFICATION_QUERY_KEYS.list({ limit: 20 });
    const data = makeData(1);
    client.setQueryData(listKey, data);
    const shouldApply = jest.fn(() => true);
    jest.spyOn(client, 'cancelQueries').mockImplementation(async () => {
      shouldApply.mockReturnValue(false);
    });

    // When
    const change = await optimisticallyMarkNotificationsRead(client, 1, { shouldApply });

    // Then
    expect(change).toBeNull();
    expect(client.getQueryData(listKey)).toBe(data);
  });
});
