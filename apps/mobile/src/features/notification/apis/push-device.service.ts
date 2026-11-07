import { pushDeviceResponseSchema, type ReportPushDeviceInput } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import { getErrorMessage } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { isEqual, noop } from 'es-toolkit';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import type { PushDevice, PushPermission } from '../schemas/push-permission.schema';
import type { DeviceIdService } from './device-id.service';
import { toPushDevice, toPushPermission, toReportPushDeviceInput } from './push-permission.mapper';

interface ReportedPushDevice {
  deviceId: string;
  input: ReportPushDeviceInput;
  timeZone: string;
  device: PushDevice;
}

export class PushDeviceService {
  readonly #gateway: PushNotificationGateway;
  readonly #deviceIdService: Pick<DeviceIdService, 'get'>;
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;
  readonly #getTimeZone: () => string;
  #lastReported: ReportedPushDevice | null = null;
  #reportInFlight: Promise<unknown> | null = null;

  constructor(
    gateway: PushNotificationGateway,
    deviceIdService: Pick<DeviceIdService, 'get'>,
    httpClient: HttpClient,
    logger: Logger,
    getTimeZone: () => string,
  ) {
    this.#gateway = gateway;
    this.#deviceIdService = deviceIdService;
    this.#httpClient = httpClient;
    this.#logger = logger;
    this.#getTimeZone = getTimeZone;
  }

  readPermission = async (): Promise<PushPermission> =>
    toPushPermission(await this.#gateway.getPermission());

  /** 시스템 권한 창을 띄우고, 바뀐 권한을 바로 서버에 알린다 */
  requestPermission = async (): Promise<PushPermission> => {
    await this.#ensureChannel();
    const permission = toPushPermission(await this.#gateway.requestPermission());
    this.#logger.info(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUESTED, { ...permission });

    // 보고가 실패해도 권한 요청 결과는 그대로 돌려준다. 보고는 다음 포그라운드에 다시 보낸다
    await this.report().then(
      (result) => {
        if (!result.ok) {
          this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, {
            errorCode: result.error.code,
          });
        }
      },
      (error: unknown) =>
        this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORT_FAILED, {
          error: getErrorMessage(error),
        }),
    );
    return permission;
  };

  /**
   * 이 기기의 권한과 토큰을 서버에 알린다. 이번 세션에 같은 값을 이미 보냈으면 요청하지 않는다.
   * 서버는 시간대를 요청 헤더에서 읽으므로 기기 시간대가 바뀌어도 다시 보낸다.
   */
  report = async ({ force = false }: { force?: boolean } = {}): Promise<
    Result<PushDevice | null, ApiError>
  > => {
    await this.#ensureChannel();
    const permission = await this.readPermission();
    const token = PushPermissionPolicy.isDeliveryAllowed(permission)
      ? await this.#issueToken()
      : null;
    const deviceId = await this.#deviceIdService.get();
    const input = toReportPushDeviceInput({ permission, token });
    const timeZone = this.#getTimeZone();

    const lastReported = this.#lastReported;
    if (
      !force &&
      lastReported != null &&
      isEqual(
        { deviceId, input, timeZone },
        {
          deviceId: lastReported.deviceId,
          input: lastReported.input,
          timeZone: lastReported.timeZone,
        },
      )
    ) {
      return ok(lastReported.device);
    }

    const request = this.#httpClient.put(`v1/notifications/push-devices/${deviceId}`, input);
    this.#reportInFlight = request;
    const result = parseApiResponse(
      await request.finally(() => {
        if (this.#reportInFlight === request) {
          this.#reportInFlight = null;
        }
      }),
      pushDeviceResponseSchema,
      toPushDevice,
      '[PushDeviceService] Invalid reportPushDevice response',
    );
    if (!result.ok) {
      return result;
    }

    const device = result.value;
    this.#lastReported = { deviceId, input, timeZone, device };
    this.#logger.info(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORTED, {
      ...permission,
      hasToken: token != null,
      hasActiveToken: device.hasActiveToken,
    });
    return ok(device);
  };

  unregister = async (config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>> => {
    // 보고가 해제보다 늦게 도착하면 로그아웃한 기기로 푸시가 다시 간다. 진행 중인 보고를 먼저 끝낸다
    await this.#reportInFlight?.catch(noop);
    this.#lastReported = null;
    const deviceId = await this.#deviceIdService.get();
    const result = await this.#httpClient.delete('v1/notifications/token', {
      ...config,
      params: { deviceId },
    });

    if (!result.ok) {
      return result;
    }

    return ok(undefined);
  };

  addTokenListener = (listener: () => void): (() => void) =>
    this.#gateway.addTokenListener(listener);

  addResponseListener = (listener: () => void): (() => void) =>
    this.#gateway.addResponseListener(listener);

  openSettings = (): Promise<void> => this.#gateway.openSettings();

  /** Android 13+는 채널이 있어야 권한 창과 토큰 발급이 동작한다. 실패해도 권한 상태는 읽고 보고한다 */
  async #ensureChannel(): Promise<void> {
    try {
      await this.#gateway.ensureChannel();
    } catch (error) {
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_CHANNEL_SETUP_FAILED, {
        error: getErrorMessage(error),
      });
    }
  }

  /** 오프라인·APNs 없는 시뮬레이터·Play 서비스 없는 에뮬레이터에서는 null이다. 권한 상태는 토큰 없이도 보고한다 */
  async #issueToken(): Promise<string | null> {
    try {
      return await this.#gateway.getToken();
    } catch (error) {
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_TOKEN_ISSUE_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    }
  }
}
