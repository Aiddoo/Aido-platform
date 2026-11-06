import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createTestDiContainer, createHttpClientStub } from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';
import { createTestDi } from '@src/shared/__tests__/create-test-di';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Slot } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { type PropsWithChildren, useState } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.fixtures';
import { useNotificationResponseObserver } from './use-notification-response-observer';

jest.unmock('expo-router');
jest.mock('@src/bootstrap/providers/auth-provider', () => ({ useAuth: jest.fn() }));

const RESPONSE = {
  id: 'response-1',
  actionIdentifier: 'default',
  data: { notificationId: 0, type: 'FOLLOW_NEW', action: { type: 'NONE' } },
};

async function setup({ status }: { status: AuthStatus }) {
  const gateway = createPushNotificationGatewayStub();
  const logger = createLoggerStub();
  let changeStatus: (next: AuthStatus) => void = noop;
  const container = createTestDiContainer(
    createTestDi({ httpClient: createHttpClientStub(), pushNotificationGateway: gateway, logger }),
  );
  const queryClient = createTestQueryClient();

  function Layout() {
    const [authStatus, setStatus] = useState(status);
    changeStatus = setStatus;
    jest.mocked(useAuth).mockReturnValue({ status: authStatus, setStatus });
    useNotificationResponseObserver();
    return <Slot />;
  }

  await renderRouter(
    { _layout: Layout, index: () => null },
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>
          <StaticDIProvider container={container}>
            <LocalDateProvider>{children}</LocalDateProvider>
          </StaticDIProvider>
        </QueryClientProvider>
      ),
    },
  );
  return {
    gateway,
    logger,
    store: container.notificationEntryStore,
    changeStatus: (next: AuthStatus) => act(async () => changeStatus(next)),
  };
}

describe('useNotificationResponseObserver', () => {
  it('눌린 응답을 슬롯에 받고 같은 알림이면 다시 받지 않는다', async () => {
    // Given
    const { gateway, store } = await setup({ status: 'unauthenticated' });
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    await act(async () => gateway.emitResponse(RESPONSE));
    await act(async () => gateway.emitResponse(RESPONSE));

    // Then
    expect(store.getState().pending?.id).toBe('response-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('data가 계약에 맞지 않으면 슬롯에 넣지 않고 경고를 남긴다', async () => {
    // Given
    const { gateway, logger, store } = await setup({ status: 'unauthenticated' });

    // When
    await act(async () => gateway.emitResponse({ ...RESPONSE, data: { context: 'broken' } }));

    // Then
    expect(store.getState().pending).toBeNull();
    expect(gateway.clearLastResponse).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('로그아웃하면 슬롯과 마지막 응답을 지운다', async () => {
    // Given
    const { gateway, store, changeStatus } = await setup({ status: 'authenticated' });
    gateway.setLastResponse(RESPONSE);

    // When
    await changeStatus('unauthenticated');

    // Then
    expect(store.getState().pending).toBeNull();
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('마지막 응답 지우기가 실패해도 경고만 남긴다', async () => {
    // Given
    const { gateway, logger, changeStatus } = await setup({ status: 'authenticated' });
    gateway.clearLastResponse.mockImplementation(() => {
      throw new Error('unavailable');
    });

    // When
    await changeStatus('unauthenticated');

    // Then
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('미인증 상태에서 받은 응답은 잠금 해제나 로그인 전까지 슬롯에 남는다', async () => {
    // Given
    const { gateway, store, changeStatus } = await setup({ status: 'unauthenticated' });
    await act(async () => gateway.emitResponse(RESPONSE));

    // When
    await changeStatus('locked');

    // Then
    expect(store.getState().pending?.id).toBe('response-1');
  });

  it('언마운트 전까지 응답 리스너는 하나다', async () => {
    // Given
    const { gateway } = await setup({ status: 'unauthenticated' });

    // When
    const count = gateway.getListenerCount();

    // Then
    expect(count).toBe(1);
  });
});
