import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { err, ok } from '@src/core/errors/result';
import {
  createHttpClientStub,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { type InfiniteData, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  createMarkReadResponseDto,
  createNotification,
  createNotificationApiError,
} from '../__tests__/notification.fixtures';
import type { NotificationListResult } from '../domains/notification.model';
import { useNotificationBadgeSync } from '../hooks/use-notification-badge-sync';
import { NOTIFICATION_QUERY_KEYS } from './notification-query-keys';
import {
  useMarkAsReadMutationOptions,
  useRecordPushOpenedMutationOptions,
} from './notification.mutations';

async function setup() {
  const server = { unreadCount: 3, finishOpened: () => {} };
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ({
    ok: true,
    value: { unreadCount: server.unreadCount },
  }));
  httpClient.post.mockImplementation(
    () =>
      new Promise((resolve) => {
        server.finishOpened = () => {
          server.unreadCount = 2;
          resolve({ ok: true, value: { opened: true } });
        };
      }),
  );
  const gateway = createPushNotificationGatewayStub();
  const container = createTestDi({ httpClient, pushNotification: gateway });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const { result } = await renderHook(
    () => {
      useNotificationBadgeSync('authenticated');
      return useMutation(useRecordPushOpenedMutationOptions());
    },
    { wrapper },
  );
  return { result, gateway, finishOpened: () => server.finishOpened() };
}

describe('useRecordPushOpenedMutationOptions', () => {
  it('느린 망에서 읽음 처리 전 수로 맞춘 배지를 처리가 끝난 뒤 다시 맞춘다', async () => {
    // Given
    const { result, gateway, finishOpened } = await setup();
    await act(async () => result.current.mutate(7));
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(3));

    // When
    await act(async () => finishOpened());

    // Then
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(2));
  });
});

describe('useMarkAsReadMutationOptions', () => {
  it('두 알림을 이어 읽다 앞 읽음만 실패하면 그 알림만 안 읽음으로 돌리고 배지는 뒤 읽음을 지킨 수로 간다', async () => {
    // Given
    const server = { unreadCount: 2 };
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(async () => ok({ unreadCount: server.unreadCount }));
    const firstRead = createPendingResponse(err(createNotificationApiError()));
    const secondRead = createPendingResponse(ok(createMarkReadResponseDto()));
    httpClient.patch
      .mockReturnValueOnce(firstRead.response)
      .mockReturnValueOnce(secondRead.response);
    const gateway = createPushNotificationGatewayStub();
    const queryClient = createTestQueryClient();
    const listKey = NOTIFICATION_QUERY_KEYS.list({ limit: 20 });
    const inbox: InfiniteData<NotificationListResult> = {
      pages: [
        {
          notifications: [createNotification({ id: 1 }), createNotification({ id: 2 })],
          hasMore: false,
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    };
    queryClient.setQueryData(listKey, inbox);
    const container = createTestDi({ httpClient, pushNotification: gateway });
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );
    const { result } = await renderHook(
      () => {
        useNotificationBadgeSync('authenticated');
        return useMutation(useMarkAsReadMutationOptions());
      },
      { wrapper },
    );
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(2));
    const reads = await act(async () => [
      result.current.mutateAsync(1).catch((error: unknown) => error),
      result.current.mutateAsync(2),
    ]);
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(0));

    // When
    await act(async () => {
      firstRead.settle();
    });
    await reads[0];

    // Then
    const readStates = () =>
      queryClient
        .getQueryData<InfiniteData<NotificationListResult>>(listKey)
        ?.pages.flatMap((page) => page.notifications)
        .map(({ id, isRead }) => ({ id, isRead }));
    expect(readStates()).toEqual([
      { id: 1, isRead: false },
      { id: 2, isRead: true },
    ]);
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(1));
    server.unreadCount = 1;
    await act(async () => {
      secondRead.settle();
    });
    await reads[1];
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(2));
    const badgeCounts = gateway.setBadgeCount.mock.calls.map(([count]) => count);
    expect(badgeCounts.slice(1)).not.toContain(2);
    expect(badgeCounts.at(-1)).toBe(1);
  });
});
