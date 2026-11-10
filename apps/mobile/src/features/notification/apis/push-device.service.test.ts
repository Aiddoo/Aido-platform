import { createSessionEpoch } from '@src/core/session/session-epoch';
import {
  createHttpClientStub,
  createIdGeneratorStub,
  createLoggerStub,
  createMemoryDeviceIdStore,
  createMemorySyncStorage,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createVendorIdGatewayStub,
} from '@src/shared/__tests__';
import { NetworkError, ok } from '@src/shared/errors';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
  createPushPermissionResponse,
  INVALID_DTO,
} from '../__tests__/notification.fixtures';
import { DeviceIdService } from './device-id.service';
import { createPushDeviceReleaseRepository } from './push-device-release.repository';
import { PushDeviceService } from './push-device.service';

const DEVICE_ID = 'ios_device-123';
const RELEASE_PATH = 'v1/notifications/push-devices/unregister';

function setup(
  gateway = createPushNotificationGatewayStub(),
  getTimeZone = () => 'Asia/Seoul',
  storage = createMemorySyncStorage(),
) {
  const sessionEpoch = createSessionEpoch();
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const publicHttpClient = createHttpClientStub();
  publicHttpClient.post.mockResolvedValue({ ok: true, value: { unregistered: true } });
  const releaseRepository = createPushDeviceReleaseRepository(storage);
  const logger = createLoggerStub();
  const service = new PushDeviceService({
    gateway,
    deviceIdService: { get: async () => DEVICE_ID },
    httpClient,
    publicHttpClient,
    releaseRepository,
    logger,
    getTimeZone,
    sessionEpoch,
  });
  return {
    service,
    gateway,
    httpClient,
    publicHttpClient,
    releaseRepository,
    logger,
    sessionEpoch,
  };
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

  it('허용된 기기에서 토큰 발급이 실패하면 서버 토큰을 지우는 token null을 보내지 않고 다음 보고에서 다시 받는다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('offline'));
    const { service, httpClient, logger } = setup(gateway);

    // When
    const skipped = await service.report();
    await service.report();

    // Then
    expect(skipped).toEqual({ ok: true, value: null });
    expect(logger.warn).toHaveBeenCalledWith('notification.push-token.issue-failed', {
      error: 'offline',
    });
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(httpClient.put).toHaveBeenCalledWith(
      `v1/notifications/push-devices/${DEVICE_ID}`,
      expect.objectContaining({ token: 'ExponentPushToken[device-123]' }),
    );
  });

  it('업데이트 뒤 첫 실행에 토큰이 늦어도 저장된 기기 id로 같은 토큰을 다시 보고하고 등록을 지우는 요청은 보내지 않는다', async () => {
    // Given
    // 이전 버전이 저장한 기기 id가 있고, 새 플랫폼 식별자는 다르다
    const deviceIdStore = createMemoryDeviceIdStore('ios_installed-before-upgrade');
    const vendorIdGateway = createVendorIdGatewayStub();
    vendorIdGateway.get.mockResolvedValue('vendor-after-upgrade');
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('timeout'));
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
    const service = new PushDeviceService({
      gateway,
      deviceIdService: new DeviceIdService({
        store: deviceIdStore,
        vendorIdGateway,
        idGenerator: createIdGeneratorStub(),
        platform: 'ios',
      }),
      httpClient,
      publicHttpClient: createHttpClientStub(),
      releaseRepository: createPushDeviceReleaseRepository(createMemorySyncStorage()),
      logger: createLoggerStub(),
      getTimeZone: () => 'Asia/Seoul',
      sessionEpoch: createSessionEpoch(),
    });

    // When
    await service.report({ force: true });
    await service.report();

    // Then
    expect(httpClient.put.mock.calls).toEqual([
      [
        'v1/notifications/push-devices/ios_installed-before-upgrade',
        expect.objectContaining({ token: 'ExponentPushToken[device-123]' }),
      ],
    ]);
    expect(httpClient.delete).not.toHaveBeenCalled();
    expect(deviceIdStore.save).not.toHaveBeenCalled();
    expect(deviceIdStore.clear).not.toHaveBeenCalled();
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

  it('권한 허용 직후처럼 같은 값을 동시에 보고하면 요청은 한 번만 보낸다', async () => {
    // Given
    const { service, httpClient } = setup();

    // When
    const [first, second] = await Promise.all([service.report(), service.report()]);

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
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
  it('시스템 창을 띄우고, 바뀐 권한을 바로 보고한다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub({
      requestPermission: jest.fn(async () => createPushPermissionResponse()),
    });
    const { service, httpClient } = setup(gateway);

    // When
    const permission = await service.requestPermission();

    // Then
    expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
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

  it('권한과 토큰을 읽는 중에 해제하면 늦은 보고를 보내지 않아 기기를 다시 등록하지 않는다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    let resolveToken: ((token: string) => void) | undefined;
    gateway.getToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );
    const { service, httpClient } = setup(gateway);
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    const reporting = service.report();
    while (resolveToken == null) {
      await Promise.resolve();
    }

    // When
    const unregistering = service.unregister();
    resolveToken('token-1');
    await Promise.all([reporting, unregistering]);

    // Then
    expect(httpClient.put).not.toHaveBeenCalled();
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });

  it('토큰 발급이 끝나지 않아도 제한 시간 뒤에 해제해 로그아웃을 붙잡지 않는다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockImplementationOnce(() => new Promise(() => {}));
    const { service, httpClient } = setup(gateway);
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    service.report();

    // When
    const result = await service.unregister({ timeout: 10 });

    // Then
    expect(result.ok).toBe(true);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });

  it('겹친 보고 중 먼저 시작한 보고가 남아 있으면 그 보고까지 기다린 뒤 해제한다', async () => {
    // Given
    const { service, httpClient } = setup();
    let resolveFirstPut: ((value: { ok: true; value: unknown }) => void) | undefined;
    httpClient.put.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstPut = resolve;
        }),
    );
    httpClient.delete.mockResolvedValue({ ok: true, value: { message: 'ok' } });
    const firstReport = service.report();
    while (resolveFirstPut == null) {
      await Promise.resolve();
    }
    await service.report({ force: true });

    // When
    const unregistering = service.unregister();
    await Promise.resolve();
    const deletedBeforeFirstSettled = httpClient.delete.mock.calls.length > 0;
    resolveFirstPut({ ok: true, value: createPushDeviceResponseDto() });
    await Promise.all([firstReport, unregistering]);

    // Then
    expect(deletedBeforeFirstSettled).toBe(false);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
  });

  it('권한과 토큰을 읽는 중에 세션이 끝나면 보고를 보내지 않는다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    let resolveToken: ((token: string) => void) | undefined;
    gateway.getToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );
    const { service, httpClient, sessionEpoch } = setup(gateway);
    const reporting = service.report();
    while (resolveToken == null) {
      await Promise.resolve();
    }

    // When
    sessionEpoch.advance();
    resolveToken('token-1');
    const result = await reporting;

    // Then
    expect(result).toEqual({ ok: true, value: null });
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it('보고를 기다리는 사이 세션이 바뀌면 해제하지 않아 새 세션의 기기 등록을 지키지 않는다', async () => {
    // Given
    // 이전 세션의 보고가 진행 중이다
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

    // When

    // 기다리는 사이 세션이 끝나고 다시 로그인해 보고가 끝난다
    sessionEpoch.advance();
    resolvePut({ ok: true, value: createPushDeviceResponseDto() });
    const [, result] = await Promise.all([reporting, unregistering]);

    // Then

    // 새 세션의 등록을 지우는 DELETE를 보내지 않고, 새 세션의 보고 기록도 지우지 않는다
    expect(result).toEqual({ ok: true, value: undefined });
    expect(httpClient.delete).not.toHaveBeenCalled();
    await service.report();
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });
});

describe('PushDeviceService.requestRelease', () => {
  it('온라인 로그아웃 없이 세션이 끝나면 인증 없이 기기 id와 지금 토큰으로 해제하고, 다음 로그인은 같은 값도 다시 등록한다', async () => {
    // Given
    const { service, httpClient, publicHttpClient, releaseRepository } = setup();
    await service.report();

    // When
    service.requestRelease();
    await service.flushRelease();
    await service.report();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledWith(RELEASE_PATH, {
      deviceId: DEVICE_ID,
      token: 'ExponentPushToken[device-123]',
    });
    expect(httpClient.post).not.toHaveBeenCalled();
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(releaseRepository.hasPending()).toBe(false);
  });

  it('연결이 끊겨 보내지 못한 해제는 앱을 다시 켜도 남아 다음 시도에 보낸다', async () => {
    // Given
    const storage = createMemorySyncStorage();
    const before = setup(undefined, undefined, storage);
    before.publicHttpClient.post.mockRejectedValueOnce(new NetworkError());
    before.service.requestRelease();
    await before.service.flushRelease();

    // When
    const after = setup(undefined, undefined, storage);
    await after.service.flushRelease();

    // Then
    expect(after.publicHttpClient.post).toHaveBeenCalledWith(RELEASE_PATH, {
      deviceId: DEVICE_ID,
      token: 'ExponentPushToken[device-123]',
    });
    expect(after.releaseRepository.hasPending()).toBe(false);
  });

  it('해제 API가 없는 이전 서버(404)면 경고 없이 끝내고 다시 보내지 않는다', async () => {
    // Given
    const { service, publicHttpClient, logger } = setup();
    publicHttpClient.post.mockResolvedValue({
      ok: false,
      error: createNotificationApiError({ status: 404 }),
    });
    service.requestRelease();
    await service.flushRelease();

    // When
    await service.flushRelease();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('토큰을 받지 못하면 해제를 보내지 않고 남겨 다음 시도에 보낸다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('offline'));
    const { service, publicHttpClient, releaseRepository } = setup(gateway);
    service.requestRelease();
    await service.flushRelease();
    expect(publicHttpClient.post).not.toHaveBeenCalled();
    expect(releaseRepository.hasPending()).toBe(true);

    // When
    await service.flushRelease();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledTimes(1);
  });

  it('보내지 못한 해제가 남은 채 다시 로그인해 보고하면 끝난 세션의 해제를 버려 새 등록을 지우지 않는다', async () => {
    // Given
    const { service, publicHttpClient } = setup();
    publicHttpClient.post.mockRejectedValueOnce(new NetworkError());
    service.requestRelease();
    await service.flushRelease();

    // When
    await service.report({ force: true });
    await service.flushRelease();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledTimes(1);
  });

  it('해제가 가는 중에 다시 로그인해 보고하면 해제가 끝난 뒤에 보고해 새 등록이 지워지지 않는다', async () => {
    // Given
    const { service, httpClient, publicHttpClient } = setup();
    const release = createPendingResponse(ok({ unregistered: true }));
    publicHttpClient.post.mockReturnValueOnce(release.response);
    service.requestRelease();
    while (publicHttpClient.post.mock.calls.length === 0) {
      await Promise.resolve();
    }

    // When
    const reporting = service.report({ force: true });
    await Promise.resolve();
    const reportedBeforeRelease = httpClient.put.mock.calls.length > 0;
    release.settle();
    await reporting;

    // Then
    expect(reportedBeforeRelease).toBe(false);
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });
});
