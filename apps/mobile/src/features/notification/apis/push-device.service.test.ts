import { createSessionEpoch } from '@src/core/session/session-epoch';
import {
  createHttpClientStub,
  createLoggerStub,
  createPushNotificationGatewayStub,
} from '@src/shared/__tests__';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
  createPushPermissionResponse,
  INVALID_DTO,
} from '../__tests__/notification.fixtures';
import { PushDeviceService } from './push-device.service';

const DEVICE_ID = 'ios_device-123';

function setup(gateway = createPushNotificationGatewayStub(), getTimeZone = () => 'Asia/Seoul') {
  const sessionEpoch = createSessionEpoch();
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const logger = createLoggerStub();
  const service = new PushDeviceService({
    gateway,
    deviceIdService: { get: async () => DEVICE_ID },
    httpClient,
    logger,
    getTimeZone,
    sessionEpoch,
  });
  return { service, gateway, httpClient, logger, sessionEpoch };
}

describe('PushDeviceService.report', () => {
  it('값이 같아도 기기 시간대가 바뀌면 서버가 헤더를 읽도록 다시 보낸다', async () => {
    // Given
    let timeZone = 'Asia/Seoul';
    const { service, httpClient } = setup(undefined, () => timeZone);
    await service.report();
    timeZone = 'America/New_York';

    // When
    await service.report();
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(2);
  });

  it('시간대 보고가 실패하면 다음 복귀 때 다시 보낸다', async () => {
    // Given
    let timeZone = 'Asia/Seoul';
    const { service, httpClient } = setup(undefined, () => timeZone);
    await service.report();
    timeZone = 'America/New_York';
    httpClient.put.mockResolvedValueOnce({
      ok: false,
      error: createNotificationApiError(),
    });
    await service.report();

    // When
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(3);
  });

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

  it('시뮬레이터라도 OS가 토큰을 주면 그 토큰으로 보고한다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub({
      getToken: jest.fn(async () => 'ExponentPushToken[simulator]'),
    });
    const { service, httpClient } = setup(gateway);

    // When
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[simulator]' }),
    );
  });

  it('토큰 발급이 실패하면(오프라인·APNs 없는 시뮬레이터) token null로 권한만 보고하고 경고로 남긴다', async () => {
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

  it('Android 알림 채널을 먼저 만든 뒤 권한을 읽고 토큰을 받는다', async () => {
    // Given
    const order: string[] = [];
    const gateway = createPushNotificationGatewayStub({
      ensureChannel: jest.fn(async () => {
        order.push('channel');
      }),
      getPermission: jest.fn(async () => {
        order.push('permission');
        return createPushPermissionResponse();
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
    expect(order).toEqual(['channel', 'permission', 'token']);
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

  it('보고가 진행 중이면 끝난 뒤에 해제해 로그아웃한 기기가 다시 활성화되지 않게 한다', async () => {
    // Given
    const { service, httpClient } = setup();
    let resolvePut: ((value: { ok: true; value: unknown }) => void) | undefined;
    httpClient.put.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        }),
    );
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    const reporting = service.report();
    while (resolvePut == null) {
      await Promise.resolve();
    }

    // When
    const unregistering = service.unregister();
    await Promise.resolve();
    const deletedBeforeReportSettled = httpClient.delete.mock.calls.length > 0;
    resolvePut({ ok: true, value: createPushDeviceResponseDto() });
    await Promise.all([reporting, unregistering]);

    // Then
    expect(deletedBeforeReportSettled).toBe(false);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });

  it('보고를 기다리는 사이 세션이 바뀌면 해제하지 않아 새 세션의 기기 등록을 지키지 않는다', async () => {
    // Given 이전 세션의 보고가 진행 중이다
    const { service, httpClient, sessionEpoch } = setup();
    let resolvePut: ((value: { ok: true; value: unknown }) => void) | undefined;
    httpClient.put.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        }),
    );
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    const reporting = service.report();
    while (resolvePut == null) {
      await Promise.resolve();
    }
    const unregistering = service.unregister();

    // When 기다리는 사이 세션이 끝나고 다시 로그인해 보고가 끝난다
    sessionEpoch.advance();
    resolvePut({ ok: true, value: createPushDeviceResponseDto() });
    const [, result] = await Promise.all([reporting, unregistering]);

    // Then 새 세션의 등록을 지우는 DELETE를 보내지 않고, 새 세션의 보고 기록도 지우지 않는다
    expect(result).toEqual({ ok: true, value: undefined });
    expect(httpClient.delete).not.toHaveBeenCalled();
    await service.report();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });
});
