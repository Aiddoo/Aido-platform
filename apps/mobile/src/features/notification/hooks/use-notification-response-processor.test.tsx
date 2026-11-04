import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { createMockDIContainer } from '@src/shared/__tests__';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useState } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.factories';
import type { NotificationAuthStatus } from '../utils/navigation/notification-response-disposition';
import { useNotificationResponseProcessor } from './use-notification-response-processor';

const logger: Logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const createResponse = (
  overrides: Partial<PushNotificationResponse> = {},
): PushNotificationResponse => ({
  id: 'response-1',
  actionIdentifier: 'default',
  data: { notificationId: 7, type: 'FOLLOW_NEW', action: { type: 'NONE' } },
  ...overrides,
});

async function setup() {
  const gateway = createPushNotificationGatewayStub();
  const handleNotificationResponse = jest.fn().mockResolvedValue('handled');
  let processResponse: (response: PushNotificationResponse) => void = () => {};
  let setSession: (session: {
    authStatus: NotificationAuthStatus;
    accountId: string | null;
  }) => void = () => {};

  function Harness() {
    const [session, setState] = useState<{
      authStatus: NotificationAuthStatus;
      accountId: string | null;
    }>({ authStatus: 'authenticated', accountId: 'account-1' });
    setSession = setState;
    processResponse = useNotificationResponseProcessor({
      ...session,
      handleNotificationResponse,
    });
    return null;
  }

  const container = createMockDIContainer({ logger, pushNotificationGateway: gateway });
  await renderRouter(
    { index: Harness },
    {
      wrapper: ({ children }) => (
        <StaticDIProvider container={container}>{children}</StaticDIProvider>
      ),
    },
  );
  await waitFor(() => expect(screen).toHavePathname('/'));

  return {
    gateway,
    handleNotificationResponse,
    process: (response: PushNotificationResponse) => act(() => processResponse(response)),
    changeSession: (session: { authStatus: NotificationAuthStatus; accountId: string | null }) =>
      act(() => setSession(session)),
  };
}

describe('useNotificationResponseProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유효한 알림 응답은 앱 모델로 처리하고 마지막 응답을 지운다', async () => {
    // Given
    const { process, handleNotificationResponse, gateway } = await setup();

    // When
    await process(createResponse());

    // Then
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalledTimes(1));
    expect(handleNotificationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        actionIdentifier: 'default',
        data: { notificationId: 7, type: 'FOLLOW_NEW', action: { type: 'NONE' } },
      }),
    );
  });

  it('이미 처리한 응답 id가 다시 오면 처리하지 않는다', async () => {
    // Given
    const { process, handleNotificationResponse, gateway } = await setup();
    await process(createResponse());
    await waitFor(() => expect(gateway.clearLastResponse).toHaveBeenCalledTimes(1));

    // When
    await process(createResponse());

    // Then
    expect(handleNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it('data가 계약에 맞지 않으면 처리하지 않고 경고를 남긴다', async () => {
    // Given
    const { process, handleNotificationResponse, gateway } = await setup();

    // When
    await process(createResponse({ data: { unknown: true } }));

    // Then
    expect(handleNotificationResponse).not.toHaveBeenCalled();
    expect(gateway.clearLastResponse).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('로그인 계정이 사라지면 마지막 응답을 지운다', async () => {
    // Given
    const { changeSession, gateway } = await setup();

    // When
    await changeSession({ authStatus: 'unauthenticated', accountId: null });

    // Then
    expect(gateway.clearLastResponse).toHaveBeenCalledTimes(1);
  });

  it('마지막 응답 지우기가 실패해도 경고만 남긴다', async () => {
    // Given
    const { changeSession, gateway } = await setup();
    gateway.clearLastResponse.mockImplementation(() => {
      throw new Error('unavailable');
    });

    // When
    await changeSession({ authStatus: 'unauthenticated', accountId: null });

    // Then
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
