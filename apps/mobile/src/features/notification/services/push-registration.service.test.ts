import { createSessionEpoch } from '@src/core/session/session-epoch';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError, ok } from '@src/shared/errors';
import {
  createHttpClientStub,
  createIdGeneratorStub,
  createLoggerStub,
  createMemoryDeviceIdStore,
  createMemoryStorage,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createVendorIdGatewayStub,
} from '@src/testing/core';

import {
  createNotificationApiError,
  createPushDeviceResponseDto,
  createPushPermissionResponse,
} from '../__tests__/notification.fixtures';
import { PushDeviceApi } from '../apis/push-device.api';
import { createPushRegistrationRepository } from '../repositories/push-registration.repository';
import { DeviceIdService } from './device-id.service';
import { PushRegistrationService } from './push-registration.service';

const DEVICE_ID = 'ios_device-123';
const RELEASE_PATH = 'v1/notifications/push-devices/unregister';
const NOW = toInstant('2026-11-12T09:00:00.000Z');

function setup(
  gateway = createPushNotificationGatewayStub(),
  getTimeZone = () => 'Asia/Seoul',
  storage = createMemoryStorage(),
  getLanguage = () => 'ko',
) {
  const sessionEpoch = createSessionEpoch();
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const publicHttpClient = createHttpClientStub();
  publicHttpClient.post.mockResolvedValue({ ok: true, value: { unregistered: true } });
  const registrationRepository = createPushRegistrationRepository(storage);
  const logger = createLoggerStub();
  const service = new PushRegistrationService({
    gateway,
    pushDeviceApi: new PushDeviceApi({ authHttpClient: httpClient, publicHttpClient }),
    deviceIdService: { get: async () => DEVICE_ID },
    registrationRepository,
    logger,
    getTimeZone,
    getLanguage,
    sessionEpoch,
    now: () => NOW,
  });
  return {
    service,
    gateway,
    httpClient,
    publicHttpClient,
    registrationRepository,
    logger,
    sessionEpoch,
  };
}

describe('PushRegistrationService.report', () => {
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

  it('앱이 뒤에 있는 사이 바뀐 언어의 보고가 실패해도 다음 복귀 때 한 번 다시 보낸다', async () => {
    // Given
    let language = 'ko';
    const { service, httpClient } = setup(undefined, undefined, undefined, () => language);
    await service.report();
    language = 'en';
    httpClient.put.mockResolvedValueOnce({ ok: false, error: createNotificationApiError() });
    await service.report({ force: true });

    // When
    await service.report();
    await service.report();

    // Then
    expect(httpClient.put).toHaveBeenCalledTimes(3);
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

  it('한 번도 토큰을 받지 못한 허용 기기는 token null로 권한·시간대를 보고하고, 토큰을 받으면 다시 보고한다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('offline'));
    const { service, httpClient, logger } = setup(gateway);

    // When
    const reported = await service.report();
    await service.report();

    // Then
    expect(reported.ok && reported.value).not.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('notification.push-token.issue-failed', {
      error: 'offline',
    });
    expect(httpClient.put.mock.calls).toEqual([
      [
        `v1/notifications/push-devices/${DEVICE_ID}`,
        expect.objectContaining({
          permission: { status: 'GRANTED', canAskAgain: false },
          token: null,
        }),
      ],
      [
        `v1/notifications/push-devices/${DEVICE_ID}`,
        expect.objectContaining({ token: 'ExponentPushToken[device-123]' }),
      ],
    ]);
  });

  it('토큰 발급이 실패해도 서버에 보고한 토큰이 있으면 그 토큰으로 보고해 시간대를 맞추고 등록은 지킨다', async () => {
    // Given
    let timeZone = 'Asia/Seoul';
    const gateway = createPushNotificationGatewayStub();
    const { service, httpClient } = setup(gateway, () => timeZone);
    await service.report();
    gateway.getToken.mockRejectedValue(new Error('APNs timeout'));
    timeZone = 'America/New_York';

    // When
    const result = await service.report();

    // Then
    expect(result.ok && result.value).not.toBeNull();
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(httpClient.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ token: 'ExponentPushToken[device-123]' }),
    );
  });

  it('업데이트 뒤 첫 실행에 토큰이 늦어도 저장된 기기 id로 보고하고, 토큰을 받으면 같은 기기 id로 다시 보고하며 등록을 지우는 요청은 보내지 않는다', async () => {
    // Given
    // 이전 버전이 저장한 기기 id가 있고, 새 플랫폼 식별자는 다르다
    const deviceIdStore = createMemoryDeviceIdStore('ios_installed-before-upgrade');
    const vendorIdGateway = createVendorIdGatewayStub();
    vendorIdGateway.get.mockResolvedValue('vendor-after-upgrade');
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('timeout'));
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
    const service = new PushRegistrationService({
      gateway,
      pushDeviceApi: new PushDeviceApi({
        authHttpClient: httpClient,
        publicHttpClient: createHttpClientStub(),
      }),
      deviceIdService: new DeviceIdService({
        store: deviceIdStore,
        vendorId: vendorIdGateway,
        idGenerator: createIdGeneratorStub(),
        platform: 'ios',
      }),
      registrationRepository: createPushRegistrationRepository(createMemoryStorage()),
      logger: createLoggerStub(),
      getTimeZone: () => 'Asia/Seoul',
      getLanguage: () => 'ko',
      sessionEpoch: createSessionEpoch(),
      now: () => NOW,
    });

    // When
    await service.report({ force: true });
    await service.report();

    // Then
    // 1.15.1 서버는 허용 상태의 token null에 이전 버전이 등록한 토큰을 지킨다
    expect(httpClient.put.mock.calls).toEqual([
      [
        'v1/notifications/push-devices/ios_installed-before-upgrade',
        expect.objectContaining({ token: null }),
      ],
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
});

describe('PushRegistrationService.requestPermission', () => {
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

describe('PushRegistrationService.unregister', () => {
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

describe('PushRegistrationService.requestRelease', () => {
  const CURRENT_TOKEN = 'ExponentPushToken[device-123]';

  it('온라인 로그아웃 없이 세션이 끝나면 인증 없이 기기 id와 보고한 토큰으로 해제하고, 다음 로그인은 같은 값도 다시 등록한다', async () => {
    // Given
    const { service, httpClient, publicHttpClient, registrationRepository } = setup();
    await service.report();

    // When
    await service.requestRelease();
    await service.report();

    // Then
    expect(publicHttpClient.post.mock.calls).toEqual([
      [RELEASE_PATH, { deviceId: DEVICE_ID, token: CURRENT_TOKEN }],
    ]);
    expect(httpClient.post).not.toHaveBeenCalled();
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(await registrationRepository.find()).toEqual({
      reportedToken: CURRENT_TOKEN,
      releaseRequestedAt: null,
    });
  });

  it('보고한 뒤 토큰이 바뀌었으면 서버가 가진 이전 토큰과 지금 토큰을 모두 푼다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    const { service, publicHttpClient } = setup(gateway);
    await service.report();
    gateway.getToken.mockResolvedValue('ExponentPushToken[rotated]');

    // When
    await service.requestRelease();

    // Then
    expect(publicHttpClient.post.mock.calls).toEqual([
      [RELEASE_PATH, { deviceId: DEVICE_ID, token: CURRENT_TOKEN }],
      [RELEASE_PATH, { deviceId: DEVICE_ID, token: 'ExponentPushToken[rotated]' }],
    ]);
  });

  it('지금 토큰을 받지 못해도 보고한 토큰으로 푼다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    const { service, publicHttpClient } = setup(gateway);
    await service.report();
    gateway.getToken.mockRejectedValue(new Error('offline'));

    // When
    await service.requestRelease();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledWith(RELEASE_PATH, {
      deviceId: DEVICE_ID,
      token: CURRENT_TOKEN,
    });
  });

  it('연결이 끊겨 보내지 못한 해제는 앱을 다시 켜도 남아 다음 시도에 보낸다', async () => {
    // Given
    const storage = createMemoryStorage();
    const before = setup(undefined, undefined, storage);
    await before.service.report();
    before.publicHttpClient.post.mockRejectedValueOnce(new NetworkError());
    await before.service.requestRelease();
    expect(await before.registrationRepository.find()).toEqual({
      reportedToken: CURRENT_TOKEN,
      releaseRequestedAt: NOW,
    });

    // When
    const after = setup(undefined, undefined, storage);
    await after.service.flushRelease();

    // Then
    expect(after.publicHttpClient.post).toHaveBeenCalledWith(RELEASE_PATH, {
      deviceId: DEVICE_ID,
      token: CURRENT_TOKEN,
    });
    expect(await after.registrationRepository.find()).toEqual({
      reportedToken: null,
      releaseRequestedAt: null,
    });
  });

  it('보고한 토큰도 지금 토큰도 없으면 해제를 남겨 토큰을 받는 다음 시도에 보낸다', async () => {
    // Given
    const gateway = createPushNotificationGatewayStub();
    gateway.getToken.mockRejectedValueOnce(new Error('offline'));
    const { service, publicHttpClient } = setup(gateway);
    await service.requestRelease();
    expect(publicHttpClient.post).not.toHaveBeenCalled();

    // When
    await service.flushRelease();

    // Then
    expect(publicHttpClient.post).toHaveBeenCalledTimes(1);
  });

  it('보내지 못한 해제가 남은 채 다시 로그인해 보고하면 끝난 세션의 해제를 버려 새 등록을 지우지 않는다', async () => {
    // Given
    const { service, publicHttpClient } = setup();
    publicHttpClient.post.mockRejectedValueOnce(new NetworkError());
    await service.requestRelease();

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
    const releasing = service.requestRelease();
    while (publicHttpClient.post.mock.calls.length === 0) {
      await Promise.resolve();
    }

    // When
    const reporting = service.report({ force: true });
    await Promise.resolve();
    const reportedBeforeRelease = httpClient.put.mock.calls.length > 0;
    release.settle();
    await Promise.all([releasing, reporting]);

    // Then
    expect(reportedBeforeRelease).toBe(false);
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });
});
