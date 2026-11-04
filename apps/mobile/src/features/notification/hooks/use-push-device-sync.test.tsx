import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import { createMockDIContainer, createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
} from '../__tests__/notification.factories';
import { PushDeviceService } from '../apis/push-device.service';
import type { NotificationAuthStatus } from '../utils/navigation/notification-response-disposition';
import { usePushDeviceSync } from './use-push-device-sync';

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

describe('usePushDeviceSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function setup(authStatus: NotificationAuthStatus = 'authenticated') {
    const removeAppStateListener = jest.fn();
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: removeAppStateListener };
    });

    const removeTokenListener = jest.fn();
    let tokenListener: (() => void) | undefined;
    const gateway = createPushNotificationGatewayStub({
      addTokenListener: jest.fn((listener: () => void) => {
        tokenListener = listener;
        return removeTokenListener;
      }),
    });
    const httpClient = createMockHttpClient();
    httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
    const pushDeviceService = new PushDeviceService(
      gateway,
      { get: async () => 'ios_device-123' },
      httpClient,
      silentLogger,
    );
    const container = createMockDIContainer({ pushDeviceService, logger: silentLogger });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );

    const hook = await renderHook(
      ({ status }: { status: NotificationAuthStatus }) => usePushDeviceSync({ authStatus: status }),
      { wrapper, initialProps: { status: authStatus } },
    );
    await act(() => jest.advanceTimersByTimeAsync(0));

    return {
      ...hook,
      gateway,
      httpClient,
      removeAppStateListener,
      removeTokenListener,
      emitAppState: (state: AppStateStatus) => appStateListener?.(state),
      emitTokenChange: () => tokenListener?.(),
    };
  }

  it('로그인이 확인되면 앱을 켤 때 한 번 보고한다', async () => {
    // When
    const { httpClient } = await setup('authenticated');

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('인증을 확인하는 중에는 보고하지 않고, 확인되면 그때 보고한다', async () => {
    // Given
    const { httpClient, rerender } = await setup('loading');
    expect(httpClient.put).not.toHaveBeenCalled();

    // When
    await rerender({ status: 'authenticated' });
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('앱으로 여러 번 돌아와도 잠시 기다렸다가 한 번만 권한을 다시 읽는다', async () => {
    // Given
    const { gateway, emitAppState } = await setup();
    gateway.getPermission.mockClear();

    // When
    await act(async () => {
      emitAppState('active');
      emitAppState('inactive');
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(gateway.getPermission).toHaveBeenCalledTimes(1);
  });

  it('기기 토큰이 바뀌면 새 토큰으로 다시 보고한다', async () => {
    // Given
    const { gateway, httpClient, emitTokenChange } = await setup();
    gateway.getToken.mockResolvedValue('ExponentPushToken[rotated]');

    // When
    await act(async () => {
      emitTokenChange();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(httpClient.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[rotated]' }),
    );
  });

  it('보고하는 동안 다시 불리면 겹쳐 보내지 않고 끝난 뒤 한 번만 더 보낸다', async () => {
    // Given
    const { gateway, httpClient, emitTokenChange } = await setup();
    let resolvePut: ((value: { ok: true; value: unknown }) => void) | undefined;
    httpClient.put.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        }),
    );
    gateway.getToken.mockResolvedValue('ExponentPushToken[first]');
    await act(async () => {
      emitTokenChange();
      await jest.advanceTimersByTimeAsync(0);
    });

    // When
    gateway.getToken.mockResolvedValue('ExponentPushToken[second]');
    await act(async () => {
      emitTokenChange();
      emitTokenChange();
      resolvePut?.({ ok: true, value: createPushDeviceResponseDto() });
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(3);
    expect(httpClient.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[second]' }),
    );
  });

  it('언마운트하면 모든 구독을 해제하고 기다리던 보고도 보내지 않는다', async () => {
    // Given
    const { gateway, unmount, emitAppState, removeAppStateListener, removeTokenListener } =
      await setup();
    gateway.getPermission.mockClear();
    emitAppState('active');

    // When
    await unmount();
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(removeTokenListener).toHaveBeenCalledTimes(1);
    expect(gateway.getPermission).not.toHaveBeenCalled();
  });
});
