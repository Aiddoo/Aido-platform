import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createHttpClientStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { NotificationType } from '../domains/notification.model';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { useForegroundNotificationSync } from './use-foreground-notification-sync';

async function setup(isAuthenticated: boolean) {
  const invalidateByType = jest.fn(async (_type: NotificationType) => {});
  const queryClient = createTestQueryClient();
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const container = createTestDi({ httpClient: createHttpClientStub() });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const hook = await renderHook(
    () => useForegroundNotificationSync({ isAuthenticated, invalidateByType }),
    { wrapper },
  );
  // 안 읽은 수(배지)도 이 무효화로 다시 받는다
  const invalidatedInbox = () =>
    invalidateQueries.mock.calls.filter(
      ([filters]) => filters?.queryKey === NOTIFICATION_QUERY_KEYS.all,
    );
  return { invalidatedInbox, invalidateByType, ...hook };
}

describe('useForegroundNotificationSync', () => {
  setupFakeTimersPerTest();

  it('알림이 도착하면 목록과 안 읽은 수를 다시 받는다', async () => {
    // Given
    const { result, invalidatedInbox } = await setup(true);

    // When
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidatedInbox()).toHaveLength(1);
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

  it('1초 안에 타입이 다른 알림이 둘 오면 두 타입의 화면을 모두 다시 받는다', async () => {
    // Given
    const { result, invalidateByType } = await setup(true);

    // When
    result.current({ data: { notificationId: 1, type: 'FOLLOW_NEW' } });
    result.current({ data: { notificationId: 2, type: 'CHEER_RECEIVED' } });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidateByType.mock.calls.map(([type]) => type).sort()).toEqual([
      'CHEER_RECEIVED',
      'FOLLOW_NEW',
    ]);
  });

  it('data가 계약에 맞지 않아도 목록과 안 읽은 수는 다시 받는다', async () => {
    // Given
    const { result, invalidatedInbox } = await setup(true);

    // When
    result.current(undefined);
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidatedInbox()).toHaveLength(1);
  });

  it('로그인하지 않았으면 아무것도 하지 않는다', async () => {
    // Given
    const { result, invalidatedInbox } = await setup(false);

    // When
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidatedInbox()).toHaveLength(0);
  });

  it('1초 안에 여러 알림이 와도 한 번만 다시 받는다', async () => {
    // Given
    const { result, invalidatedInbox } = await setup(true);

    // When
    result.current({ data: {} });
    result.current({ data: {} });
    await act(() => jest.advanceTimersByTimeAsync(1000));

    // Then
    expect(invalidatedInbox()).toHaveLength(1);
  });
});
