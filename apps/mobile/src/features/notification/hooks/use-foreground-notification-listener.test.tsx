import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi } from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.fixtures';
import { useForegroundNotificationListener } from './use-foreground-notification-listener';

async function setup() {
  const gateway = createPushNotificationGatewayStub();
  const handleForegroundNotification = jest.fn();
  const container = createTestDi({
    logger: createLoggerStub(),
    pushNotificationGateway: gateway,
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const hook = await renderHook(
    () => useForegroundNotificationListener(handleForegroundNotification),
    { wrapper },
  );
  return { gateway, handleForegroundNotification, ...hook };
}

describe('useForegroundNotificationListener', () => {
  it('앱이 켜진 동안 알림이 도착하면 포그라운드 처리기에 넘긴다', async () => {
    // Given
    const { gateway, handleForegroundNotification } = await setup();

    // When
    gateway.emitReceived({ data: { notificationId: 1 } });

    // Then
    expect(handleForegroundNotification).toHaveBeenCalledWith({ data: { notificationId: 1 } });
  });

  it('언마운트하면 구독을 끝낸다', async () => {
    // Given
    const { gateway, unmount } = await setup();

    // When
    await unmount();

    // Then
    expect(gateway.getListenerCount()).toBe(0);
  });
});
