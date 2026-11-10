import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useNotificationBadgeSync } from '../hooks/use-notification-badge-sync';
import { useRecordPushOpenedMutationOptions } from './notification.mutations';

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
