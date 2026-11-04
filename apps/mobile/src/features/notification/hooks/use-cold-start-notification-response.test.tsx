import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMockDIContainer } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.factories';
import { useColdStartNotificationResponse } from './use-cold-start-notification-response';

const response = { id: 'r1', actionIdentifier: 'default', data: { notificationId: 1 } };

async function setup(lastResponse: typeof response | null) {
  const gateway = createPushNotificationGatewayStub();
  gateway.setLastResponse(lastResponse);
  const processResponse = jest.fn();
  const container = createMockDIContainer({ pushNotificationGateway: gateway });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const hook = await renderHook(() => useColdStartNotificationResponse({ processResponse }), {
    wrapper,
  });
  return { gateway, processResponse, ...hook };
}

describe('useColdStartNotificationResponse', () => {
  it('앱이 꺼진 상태에서 눌러 시작한 응답을 처리기에 넘긴다', async () => {
    // Given
    // When
    const { processResponse } = await setup(response);

    // Then
    expect(processResponse).toHaveBeenCalledWith(response);
  });

  it('시작 응답이 없으면 처리기를 부르지 않는다', async () => {
    // Given
    // When
    const { processResponse } = await setup(null);

    // Then
    expect(processResponse).not.toHaveBeenCalled();
  });

  it('이후 도착한 응답도 넘기고 같은 알림이면 다시 넘기지 않는다', async () => {
    // Given
    const { gateway, processResponse } = await setup(null);

    // When
    await act(async () => gateway.emitResponse(response));
    await act(async () => gateway.emitResponse(response));

    // Then
    expect(processResponse).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 구독을 끝낸다', async () => {
    // Given
    const { gateway, unmount } = await setup(null);

    // When
    await unmount();

    // Then
    expect(gateway.getListenerCount()).toBe(0);
  });
});
