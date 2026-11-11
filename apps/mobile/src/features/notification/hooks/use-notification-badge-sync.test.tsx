import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { useNotificationBadgeSync } from './use-notification-badge-sync';

async function setup() {
  const server = { unreadCount: 3 };
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ({
    ok: true,
    value: { unreadCount: server.unreadCount },
  }));
  const gateway = createPushNotificationGatewayStub();
  const container = createTestDi({ httpClient, pushNotification: gateway });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  await renderHook(() => useNotificationBadgeSync('authenticated'), { wrapper });
  await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(3));
  return { server, gateway, queryClient };
}

describe('useNotificationBadgeSync', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it('앱이 앞으로 돌아오면 다른 기기에서 바뀐 서버의 안 읽은 수로 배지를 맞춘다', async () => {
    // Given
    const { server, gateway } = await setup();
    server.unreadCount = 1;

    // When
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    // Then
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(1));
  });

  it('알림함이 고친 안 읽은 수 캐시를 그대로 배지에 쓴다', async () => {
    // Given
    const { gateway, queryClient } = await setup();

    // When
    await act(async () => {
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), 2);
    });

    // Then
    await waitFor(() => expect(gateway.setBadgeCount).toHaveBeenLastCalledWith(2));
  });
});
