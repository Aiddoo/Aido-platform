import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { NotificationType } from '../domains/notification.model';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';
import { useForegroundPushSync } from './use-foreground-push-sync';

async function setup(authStatus: AuthStatus) {
  const invalidateByType = jest.fn(async (_type: NotificationType) => {});
  const queryClient = createTestQueryClient();
  const fetchUnreadCount = jest.fn(async () => 0);
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
    iosStatus: null,
  });
  const container = createTestDi({ httpClient: createHttpClientStub(), pushNotification });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const hook = await renderHook(
    () => {
      // 알림 설정 행처럼 권한을 보고 있는 화면
      useQuery(useGetPushPermissionQueryOptions());
      // 안 읽은 수(배지)를 보고 있는 화면
      useQuery({
        queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
        queryFn: fetchUnreadCount,
        staleTime: Infinity,
      });
      useForegroundPushSync({ authStatus, invalidateByType });
    },
    { wrapper },
  );
  await act(() => jest.advanceTimersByTimeAsync(0));
  fetchUnreadCount.mockClear();
  // 안 읽은 수(배지)도 이 무효화로 다시 받는다
  const refetchedUnreadCount = () => fetchUnreadCount.mock.calls;
  return {
    refetchedUnreadCount,
    invalidateByType,
    getPermission: pushNotification.getPermission,
    receive: (data: Record<string, unknown>) => pushNotification.emitReceived({ data }),
    ...hook,
  };
}

describe('useForegroundPushSync', () => {
  setupFakeTimersPerTest();

  it('알림이 도착하면 목록과 안 읽은 수를 다시 받는다', async () => {
    // Given
    const { receive, refetchedUnreadCount } = await setup('authenticated');

    // When
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(refetchedUnreadCount()).toHaveLength(1);
  });

  it('받은 알림 타입으로 다른 기능의 화면을 다시 받는다', async () => {
    // Given
    const { receive, invalidateByType } = await setup('authenticated');

    // When
    receive({ notificationId: 1, type: 'FOLLOW_NEW', action: { type: 'DEEP_LINK' } });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidateByType).toHaveBeenCalledWith('FOLLOW_NEW');
  });

  it('1초 안에 타입이 다른 알림이 둘 오면 두 타입의 화면을 모두 다시 받는다', async () => {
    // Given
    const { receive, invalidateByType } = await setup('authenticated');

    // When
    receive({ notificationId: 1, type: 'FOLLOW_NEW' });
    receive({ notificationId: 2, type: 'CHEER_RECEIVED' });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidateByType.mock.calls.map(([type]) => type).sort()).toEqual([
      'CHEER_RECEIVED',
      'FOLLOW_NEW',
    ]);
  });

  it('data가 계약에 맞지 않아도 목록과 안 읽은 수는 다시 받는다', async () => {
    // Given
    const { receive, refetchedUnreadCount } = await setup('authenticated');

    // When
    receive({ navigation: 'broken' });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(refetchedUnreadCount()).toHaveLength(1);
  });

  it('로그인하지 않았으면 아무것도 하지 않는다', async () => {
    // Given
    const { receive, refetchedUnreadCount } = await setup('unauthenticated');

    // When
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(refetchedUnreadCount()).toHaveLength(0);
  });

  it('1초 안에 여러 알림이 와도 한 번만 다시 받는다', async () => {
    // Given
    const { receive, refetchedUnreadCount } = await setup('authenticated');

    // When
    receive({});
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(refetchedUnreadCount()).toHaveLength(1);
  });

  it('푸시를 받아도 OS 권한은 다시 묻지 않는다', async () => {
    // Given
    const { receive, getPermission } = await setup('authenticated');
    await act(() => jest.advanceTimersByTimeAsync(0));
    const callsBefore = getPermission.mock.calls.length;

    // When
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));
    receive({});
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(getPermission.mock.calls.length - callsBefore).toBe(0);
  });
});
