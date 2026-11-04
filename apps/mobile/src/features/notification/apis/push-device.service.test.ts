import type { Logger } from '@src/core/ports/logger';
import { createMockHttpClient } from '@src/shared/__tests__';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
  createPushPermissionResponse,
  INVALID_DTO,
} from '../__tests__/notification.factories';
import { PushDeviceService } from './push-device.service';

const DEVICE_ID = 'ios_device-123';

function setup(gateway = createPushNotificationGatewayStub()) {
  const httpClient = createMockHttpClient();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const logger: jest.Mocked<Logger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const service = new PushDeviceService(
    gateway,
    { get: async () => DEVICE_ID },
    httpClient,
    logger,
  );
  return { service, gateway, httpClient, logger };
}

describe('PushDeviceService.report', () => {
  it('허용된 기기는 권한과 토큰을 기기 경로로 보고하고 토큰은 로그에 남기지 않는다', async () => {
    // Given
    const { service, httpClient, logger } = setup();

    // When
    const result = await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(`v1/notifications/push-devices/${DEVICE_ID}`, {
      permission: { status: 'GRANTED', canAskAgain: false },
      token: 'ExponentPushToken[device-123]',
      payloadVersion: 2,
    });
    expect(result.ok && result.value?.hasActiveToken).toBe(true);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('ExponentPushToken');
  });

  it('iOS 임시 허용도 토큰을 받아 보고한다', async () => {
    // Given
    const { service, httpClient } = setup(
      createPushNotificationGatewayStub({
        getPermission: jest.fn(async () =>
          createPushPermissionResponse({
            status: 'undetermined',
            canAskAgain: true,
            iosStatus: 'PROVISIONAL',
          }),
        ),
      }),
    );

    // When
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        permission: { status: 'PROVISIONAL', canAskAgain: true },
        token: 'ExponentPushToken[device-123]',
      }),
    );
  });

  it('거절한 기기는 토큰을 받지 않고 권한 상태만 보고한다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub({
      getPermission: jest.fn(async () =>
        createPushPermissionResponse({ status: 'denied', canAskAgain: false }),
      ),
    });
    const { service, httpClient } = setup(gateway);

    // When
    await service.report();

    // Then
    expect(gateway.getToken).not.toHaveBeenCalled();
    expect(httpClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        permission: { status: 'DENIED', canAskAgain: false },
        token: null,
      }),
    );
  });

  it('시뮬레이터는 토큰 없이도 권한 상태를 보고한다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub({ isPhysicalDevice: jest.fn(() => false) });
    const { service, httpClient } = setup(gateway);

    // When
    await service.report();

    // Then
    expect(gateway.getToken).not.toHaveBeenCalled();
    expect(httpClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: null }),
    );
  });

  it('토큰 발급이 실패해도 권한 상태는 보고하고 경고로 남긴다', async () => {
    // Given
    const { service, httpClient, logger } = setup(
      createPushNotificationGatewayStub({
        getToken: jest.fn(async () => {
          throw new Error('offline');
        }),
      }),
    );

    // When
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: null }),
    );
    expect(logger.warn).toHaveBeenCalledWith('notification.push-token.issue-failed', {
      error: 'offline',
    });
  });

  it('Android는 토큰을 받기 전에 알림 채널을 만든다', async () => {
    // Given
    const order: string[] = [];
    const gateway = createPushNotificationGatewayStub({
      ensureChannel: jest.fn(async () => {
        order.push('channel');
      }),
      getToken: jest.fn(async () => {
        order.push('token');
        return 'ExponentPushToken[device-123]';
      }),
    });
    const { service } = setup(gateway);

    // When
    await service.report();

    // Then
    expect(order).toEqual(['channel', 'token']);
  });

  it('이번 세션에 같은 값을 이미 보냈으면 다시 요청하지 않고, 토큰이 바뀌면 다시 보낸다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    const { service, httpClient } = setup(gateway);
    await service.report();

    // When
    await service.report();
    gateway.getToken.mockResolvedValue('ExponentPushToken[rotated]');
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(httpClient.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[rotated]' }),
    );
  });

  it('언어가 바뀌는 등 강제로 보내면 같은 값이어도 다시 요청한다', async () => {
    // Given
    const { service, httpClient } = setup();
    await service.report();

    // When
    await service.report({ force: true });

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(2);
  });

  it('서버 4xx는 Result.err로 돌려주고 다음 보고를 막지 않는다', async () => {
    // Given
    const { service, httpClient } = setup();
    const apiError = createNotificationApiError();
    httpClient.put.mockResolvedValueOnce({ ok: false, error: apiError });

    // When
    const failed = await service.report();
    await service.report();

    // Then
    expect(failed).toEqual({ ok: false, error: apiError });
    expect(httpClient.put).toHaveBeenCalledTimes(2);
  });

  it('응답 계약이 맞지 않으면 ParseError를 던진다', async () => {
    // Given
    const { service, httpClient } = setup();
    httpClient.put.mockResolvedValue({ ok: true, value: INVALID_DTO });

    // When
    const result = service.report();

    // Then
    await expect(result).rejects.toThrow('Invalid reportPushDevice response');
  });
});

describe('PushDeviceService.requestPermission', () => {
  it('채널을 먼저 만든 뒤 시스템 창을 띄우고, 바뀐 권한을 바로 보고한다', async () => {
    // Given
    const order: string[] = [];
    const gateway = createPushNotificationGatewayStub({
      ensureChannel: jest.fn(async () => {
        order.push('channel');
      }),
      requestPermission: jest.fn(async () => {
        order.push('request');
        return createPushPermissionResponse();
      }),
    });
    const { service, httpClient } = setup(gateway);

    // When
    const permission = await service.requestPermission();

    // Then
    expect(order.slice(0, 2)).toEqual(['channel', 'request']);
    expect(permission).toEqual({ status: 'GRANTED', canAskAgain: false });
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it('보고가 실패해도 권한 요청 결과는 돌려준다', async () => {
    // Given
    const { service, httpClient, logger } = setup();
    httpClient.put.mockRejectedValue(new Error('offline'));

    // When
    const permission = await service.requestPermission();

    // Then
    expect(permission.status).toBe('GRANTED');
    expect(logger.warn).toHaveBeenCalledWith('notification.push-device.report-failed', {
      error: 'offline',
    });
  });
});

describe('PushDeviceService.unregister', () => {
  it('이 기기의 토큰만 해제하고, 다시 로그인하면 같은 값도 다시 보고한다', async () => {
    // Given
    const { service, httpClient } = setup();
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    await service.report();

    // When
    const result = await service.unregister({ timeout: 3_000 });
    await service.report();

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/notifications/token', {
      timeout: 3_000,
      params: { deviceId: DEVICE_ID },
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(httpClient.put).toHaveBeenCalledTimes(2);
  });
});
