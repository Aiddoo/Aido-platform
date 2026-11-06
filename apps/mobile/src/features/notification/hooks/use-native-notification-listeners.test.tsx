import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import { createTestDiContainer } from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.fixtures';
import { useNativeNotificationListeners } from './use-native-notification-listeners';

const logger: Logger = createLoggerStub();

async function setup() {
  const gateway = createPushNotificationGatewayStub();
  const processResponse = jest.fn();
  const handleForegroundNotification = jest.fn();
  const container = createTestDiContainer({ logger, pushNotificationGateway: gateway });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const hook = await renderHook(
    () => useNativeNotificationListeners({ processResponse, handleForegroundNotification }),
    { wrapper },
  );
  return { gateway, processResponse, handleForegroundNotification, ...hook };
}

describe('useNativeNotificationListeners', () => {
  it('앱이 켜진 동안 알림이 도착하면 포그라운드 처리기에 넘긴다', async () => {
    // Given
    const { gateway, handleForegroundNotification } = await setup();

    // When
    gateway.emitReceived({ data: { notificationId: 1 } });

    // Then
    expect(handleForegroundNotification).toHaveBeenCalledWith({ data: { notificationId: 1 } });
  });

  it('알림을 누르면 응답 처리기에 넘긴다', async () => {
    // Given
    const { gateway, processResponse } = await setup();
    const response = { id: 'r1', actionIdentifier: 'default', data: {} };

    // When
    gateway.emitResponse(response);

    // Then
    expect(processResponse).toHaveBeenCalledWith(response);
  });

  it('언마운트하면 두 구독을 모두 끝낸다', async () => {
    // Given
    const { gateway, unmount } = await setup();

    // When
    await unmount();

    // Then
    expect(gateway.getListenerCount()).toBe(0);
  });
});
