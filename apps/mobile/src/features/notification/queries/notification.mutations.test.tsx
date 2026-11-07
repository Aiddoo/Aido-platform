import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi, createHttpClientStub, createLoggerStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.fixtures';
import { NotificationService } from '../apis/notification.service';
import { useRecordPushOpenedMutationOptions } from './notification.mutations';

async function setup() {
  let unreadCount = 3;
  let finishOpened: () => void = () => undefined;
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async () => ({ ok: true, value: { unreadCount } }));
  httpClient.post.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishOpened = () => {
          unreadCount = 2;
          resolve({ ok: true, value: { opened: true } });
        };
      }),
  );
  const gateway = createPushNotificationGatewayStub();
  const container = createTestDi({
    notificationService: new NotificationService(httpClient, gateway, httpClient),
    logger: createLoggerStub(),
  });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const { result } = await renderHook(() => useMutation(useRecordPushOpenedMutationOptions()), {
    wrapper,
  });
  return { result, gateway, finishOpened: () => finishOpened() };
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
