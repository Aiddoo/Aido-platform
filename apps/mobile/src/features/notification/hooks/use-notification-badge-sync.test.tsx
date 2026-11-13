import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { focusManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { useNotificationBadgeSync } from './use-notification-badge-sync';

async function setup() {
  const server = { unreadCount: 3 };
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ({
    ok: true,
    value: { unreadCount: server.unreadCount },
  }));
  const gateway = createPushNotificationGatewayStub();
  const { queryClient } = await renderScreenHook(
    () => useNotificationBadgeSync({ authStatus: 'authenticated' }),
    { di: createTestDi({ ports: { httpClient, pushNotification: gateway } }) },
  );
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
