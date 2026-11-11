import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createSessionEpoch } from '@src/core/session/session-epoch';
import { getNowInstant } from '@src/shared/date/clock';
import {
  createAppLifecycleGatewayStub,
  createHttpClientStub,
  createLoggerStub,
  createMemoryStorage,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
} from '../__tests__/notification.fixtures';
import { PushDeviceApi } from '../apis/push-device.api';
import { createPushRegistrationRepository } from '../repositories/push-registration.repository';
import { PushRegistrationService } from '../services/push-registration.service';
import { usePushDeviceSync } from './use-push-device-sync';

describe('usePushDeviceSync', () => {
  beforeEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useFakeTimers();
  });

  afterEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function setup(authStatus: AuthStatus = 'authenticated') {
    const appLifecycle = createAppLifecycleGatewayStub();

    const removeTokenListener = jest.fn();
    let tokenListener: (() => void) | undefined;
    const gateway = createPushNotificationGatewayStub({
      subscribeToken: jest.fn((listener: () => void) => {
        tokenListener = listener;
        return removeTokenListener;
      }),
    });
    let responseListener: (() => void) | undefined;
    gateway.subscribeResponse.mockImplementation((listener) => {
      responseListener = () =>
        listener({ id: 'response-1', actionIdentifier: 'default', data: {} });
      return jest.fn();
    });
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
    const timeZone = { current: 'Asia/Seoul' };
    const onReported = jest.fn();
    const pushRegistrationService = new PushRegistrationService({
      gateway,
      pushDeviceApi: new PushDeviceApi({ httpClient, publicHttpClient: httpClient }),
      deviceIdService: { get: async () => 'ios_device-123' },
      registrationRepository: createPushRegistrationRepository(createMemoryStorage()),
      logger: createLoggerStub(),
      getTimeZone: () => timeZone.current,
      getLanguage: () => 'ko',
      sessionEpoch: createSessionEpoch(),
      now: getNowInstant,
    });
    const container = createTestDi({
      pushRegistrationService,
      pushNotification: gateway,
      appLifecycle,
      logger: createLoggerStub(),
    });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );

    const hook = await renderHook(
      ({ status, deviceTimeZone }: { status: AuthStatus; deviceTimeZone?: string }) =>
        usePushDeviceSync({ authStatus: status, deviceTimeZone, onReported }),
      { wrapper, initialProps: { status: authStatus } },
    );
    await act(() => jest.advanceTimersByTimeAsync(0));

    return {
      ...hook,
      gateway,
      httpClient,
      timeZone,
      onReported,
      emitPushTap: () => responseListener?.(),
      appLifecycle,
      removeTokenListener,
      emitAppState: appLifecycle.emit,
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

  it('시간대를 바꾸고 앱으로 돌아오면 요청이 없는 화면이어도 바로 보고한다', async () => {
    // Given
    const { httpClient, timeZone, emitAppState } = await setup();
    httpClient.put.mockClear();
    timeZone.current = 'America/New_York';

    // When
    await act(async () => {
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('시간대가 그대로면 앱으로 돌아와도 요청하지 않는다', async () => {
    // Given
    const { httpClient, emitAppState } = await setup();
    httpClient.put.mockClear();

    // When
    await act(async () => {
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('푸시를 누르면 시간대가 바뀌었을 때 다시 보고한다', async () => {
    // Given
    const { httpClient, timeZone, emitPushTap } = await setup();
    httpClient.put.mockClear();
    timeZone.current = 'America/New_York';

    // When
    await act(async () => {
      emitPushTap();
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('앞에 떠 있는 동안 시간대가 바뀌면 복귀를 기다리지 않고 보고한다', async () => {
    // Given
    const { httpClient, timeZone, rerender } = await setup();
    httpClient.put.mockClear();
    timeZone.current = 'America/New_York';

    // When
    await rerender({ status: 'authenticated', deviceTimeZone: 'America/New_York' });
    await act(() => jest.advanceTimersByTimeAsync(0));

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('보고가 성공할 때만 onReported를 부른다', async () => {
    // Given
    const { httpClient, onReported, timeZone, emitAppState } = await setup();
    expect(onReported).toHaveBeenCalledTimes(1);
    timeZone.current = 'America/New_York';
    httpClient.put.mockResolvedValueOnce({ ok: false, error: createNotificationApiError() });

    // When
    await act(async () => {
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(onReported).toHaveBeenCalledTimes(1);
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
    const { gateway, unmount, emitAppState, appLifecycle, removeTokenListener } = await setup();
    gateway.getPermission.mockClear();
    emitAppState('active');

    // When
    await unmount();
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
    expect(removeTokenListener).toHaveBeenCalledTimes(1);
    expect(gateway.getPermission).not.toHaveBeenCalled();
  });
});
