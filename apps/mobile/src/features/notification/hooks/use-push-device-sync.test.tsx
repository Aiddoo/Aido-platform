import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAppLifecycleGatewayStub,
  createHttpClientStub,
  createMemoryDeviceIdStore,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act } from '@testing-library/react-native';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
} from '../__tests__/notification.fixtures';
import { usePushDeviceSync } from './use-push-device-sync';

interface SyncProps {
  status: AuthStatus;
  deviceTimeZone?: string;
}

describe('usePushDeviceSync', () => {
  setupFakeTimersPerTest();

  afterEach(() => {
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
    const di = createTestDi({
      ports: {
        httpClient,
        pushNotification: gateway,
        appLifecycle,
        deviceIdStore: createMemoryDeviceIdStore('ios_device-123'),
        getTimeZone: () => timeZone.current,
      },
    });

    const initialProps: SyncProps = { status: authStatus };
    const hook = await renderScreenHook(
      ({ status, deviceTimeZone }: SyncProps) =>
        usePushDeviceSync({ authStatus: status, deviceTimeZone, onReported }),
      { di, initialProps },
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
      pushRegistrationService: di.pushRegistrationService,
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
      emitAppState('background');
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
      emitAppState('background');
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
      emitAppState('background');
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
      emitAppState('background');
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(onReported).toHaveBeenCalledTimes(1);
  });

  it('보고가 가는 사이 로그아웃하면 늦게 도착한 성공을 알리지 않는다', async () => {
    // Given
    const put = createPendingResponse(ok(createPushDeviceResponseDto()));
    const { httpClient, onReported, rerender } = await setup('loading');
    httpClient.put.mockReturnValueOnce(put.response);
    await rerender({ status: 'authenticated' });
    await act(() => jest.advanceTimersByTimeAsync(0));
    expect(httpClient.put).toHaveBeenCalledTimes(1);

    // When
    await rerender({ status: 'unauthenticated' });
    await act(async () => {
      put.settle();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    expect(onReported).not.toHaveBeenCalled();
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
    const put = createPendingResponse(ok(createPushDeviceResponseDto()));
    httpClient.put.mockReturnValueOnce(put.response);
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
      put.settle();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(3);
    expect(httpClient.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[second]' }),
    );
  });

  it('로그아웃 상태면 켤 때와 앱이 앞으로 올 때 끝난 세션의 해제를 다시 보내고 보고하지 않는다', async () => {
    // Given
    const { pushRegistrationService, httpClient, rerender, emitAppState } = await setup('loading');
    // 끊긴 채 끝난 세션이라 해제 기록이 남아 있다
    httpClient.post.mockRejectedValue(new NetworkError());
    await act(() => pushRegistrationService.requestRelease());
    httpClient.post.mockClear();

    // When
    await rerender({ status: 'unauthenticated' });
    await act(async () => {
      emitAppState('background');
      emitAppState('active');
      await jest.advanceTimersByTimeAsync(1_000);
    });

    // Then
    expect(httpClient.post).toHaveBeenCalledTimes(2);
    expect(httpClient.post).toHaveBeenLastCalledWith(
      'v1/notifications/push-devices/unregister',
      expect.objectContaining({ token: 'ExponentPushToken[device-123]' }),
    );
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('언마운트하면 모든 구독을 해제하고 기다리던 보고도 보내지 않는다', async () => {
    // Given
    const { gateway, unmount, emitAppState, appLifecycle, removeTokenListener } = await setup();
    gateway.getPermission.mockClear();
    emitAppState('background');
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
