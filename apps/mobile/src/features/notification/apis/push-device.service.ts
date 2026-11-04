import { pushDeviceResponseSchema, type ReportPushDeviceInput } from '@aido/api';
import type { HttpClient, RequestConfig } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import { errorMessageOf } from '@src/shared/errors';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import { isEqual } from 'es-toolkit';
import { Platform } from 'react-native';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import {
  isDeliveryAllowed,
  type PushDevice,
  type PushPermission,
} from '../domains/push-permission.model';
import type { DeviceIdService } from './device-id.service';
import { toPushDevice, toPushPermission, toReportPushDeviceInput } from './push-permission.mapper';

interface ReportedPushDevice {
  deviceId: string;
  input: ReportPushDeviceInput;
  device: PushDevice;
}

export class PushDeviceService {
  readonly #gateway: PushNotificationGateway;
  readonly #deviceIdService: Pick<DeviceIdService, 'get'>;
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;
  #lastReported: ReportedPushDevice | null = null;

  constructor(
    gateway: PushNotificationGateway,
    deviceIdService: Pick<DeviceIdService, 'get'>,
    httpClient: HttpClient,
    logger: Logger,
  ) {
    this.#gateway = gateway;
    this.#deviceIdService = deviceIdService;
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  readPermission = async (): Promise<PushPermission> =>
    toPushPermission(await this.#gateway.getPermission());

  /** 시스템 권한 창을 띄우고, 바뀐 권한을 바로 서버에 알린다 */
  requestPermission = async (): Promise<PushPermission> => {
    await this.#gateway.ensureChannel();
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
          error: errorMessageOf(error),
        }),
    );
    return permission;
  };

  /**
   * 이 기기의 권한과 토큰을 서버에 알린다. 이번 세션에 같은 값을 이미 보냈으면 요청하지 않는다.
   * 웹은 푸시 기기가 아니라 보내지 않고 null을 돌려준다.
   */
  report = async ({ force = false }: { force?: boolean } = {}): Promise<
    Result<PushDevice | null, ApiError>
  > => {
    if (Platform.OS === 'web') {
      return ok(null);
    }

    const permission = await this.readPermission();
    const token = isDeliveryAllowed(permission) ? await this.#issueToken() : null;
    const deviceId = await this.#deviceIdService.get();
    const input = toReportPushDeviceInput({ permission, token });

    const lastReported = this.#lastReported;
    if (
      !force &&
      lastReported != null &&
      isEqual({ deviceId, input }, { deviceId: lastReported.deviceId, input: lastReported.input })
    ) {
      return ok(lastReported.device);
    }

    const result = await this.#httpClient.put(`v1/notifications/push-devices/${deviceId}`, input);
    if (!result.ok) {
      return result;
    }

    const parsed = pushDeviceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[PushDeviceService] Invalid reportPushDevice response: ${parsed.error.message}`,
      );
    }

    const device = toPushDevice(parsed.data);
    this.#lastReported = { deviceId, input, device };
    this.#logger.info(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_REPORTED, {
      ...permission,
      hasToken: token != null,
      hasActiveToken: device.hasActiveToken,
    });
    return ok(device);
  };

  unregister = async (config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>> => {
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

  openSettings = (): Promise<void> => this.#gateway.openSettings();

  /** 시뮬레이터이거나 발급에 실패하면 null이다. 권한 상태는 토큰 없이도 보고한다 */
  async #issueToken(): Promise<string | null> {
    if (!this.#gateway.isPhysicalDevice()) {
      return null;
    }

    try {
      await this.#gateway.ensureChannel();
      return await this.#gateway.getToken();
    } catch (error) {
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_TOKEN_ISSUE_FAILED, {
        error: errorMessageOf(error),
      });
      return null;
    }
  }
}
