import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { useForegroundNotificationSync } from './use-foreground-notification-sync';

const UNREAD_COUNT = 5;

async function setup(isAuthenticated: boolean) {
  const invalidateByType = jest.fn(async () => {});
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue({ ok: true, value: { unreadCount: UNREAD_COUNT } });
  const pushNotification = createPushNotificationGatewayStub();
  const syncBadgeCount = pushNotification.setBadgeCount;
  const queryClient = createTestQueryClient();
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const container = createTestDi({ httpClient, pushNotification });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const hook = await renderHook(
    () => useForegroundNotificationSync({ isAuthenticated, invalidateByType }),
    { wrapper },
  );
  return { syncBadgeCount, invalidateQueries, invalidateByType, ...hook };
}

describe('useForegroundNotificationSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('알림이 도착하면 목록을 다시 받고 배지를 맞춘다', async () => {
    // Given
    const { result, syncBadgeCount, invalidateQueries } = await setup(true);

    // When
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: NOTIFICATION_QUERY_KEYS.all });
    expect(syncBadgeCount).toHaveBeenCalledTimes(1);
    expect(syncBadgeCount).toHaveBeenCalledWith(UNREAD_COUNT);
  });

  it('받은 알림 타입으로 다른 기능의 화면을 다시 받는다', async () => {
    // Given
    const { result, invalidateByType } = await setup(true);

    // When
    result.current({
      data: { notificationId: 1, type: 'FOLLOW_NEW', action: { type: 'DEEP_LINK' } },
    });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidateByType).toHaveBeenCalledWith('FOLLOW_NEW');
  });

  it('data가 계약에 맞지 않아도 목록과 배지는 맞춘다', async () => {
    // Given
    const { result, syncBadgeCount } = await setup(true);

    // When
    result.current(undefined);
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(syncBadgeCount).toHaveBeenCalledTimes(1);
  });

  it('로그인하지 않았으면 아무것도 하지 않는다', async () => {
    // Given
    const { result, syncBadgeCount } = await setup(false);

    // When
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(syncBadgeCount).not.toHaveBeenCalled();
  });

  it('1초 안에 여러 알림이 와도 한 번만 맞춘다', async () => {
    // Given
    const { result, syncBadgeCount } = await setup(true);

    // When
    result.current({ data: {} });
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(syncBadgeCount).toHaveBeenCalledTimes(1);
  });
});
