import { pushDeviceResponseSchema, type ReportPushDeviceInput } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { isEqual, noop, withTimeout } from 'es-toolkit';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import type { PushDevice, PushPermission } from '../domains/push-permission.model';
import type { DeviceIdService } from './device-id.service';
import { toPushDevice, toPushPermission, toReportPushDeviceInput } from './push-permission.mapper';

const REPORT_WAIT_TIMEOUT_MS = 3_000;

interface ReportedPushDevice {
  deviceId: string;
  input: ReportPushDeviceInput;
  timeZone: string;
  device: PushDevice;
}

interface PushDeviceServicePorts {
  gateway: PushNotificationGateway;
  deviceIdService: Pick<DeviceIdService, 'get'>;
  httpClient: HttpClient;
  logger: Logger;
  getTimeZone: () => string;
  sessionEpoch: Pick<SessionEpoch, 'current'>;
}

export class PushDeviceService {
  readonly #gateway: PushNotificationGateway;
  readonly #deviceIdService: Pick<DeviceIdService, 'get'>;
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;
  readonly #getTimeZone: () => string;
  readonly #sessionEpoch: Pick<SessionEpoch, 'current'>;
  #lastReported: ReportedPushDevice | null = null;
  readonly #reportsInFlight = new Set<Promise<unknown>>();
  #unregisterCount = 0;

  constructor({
    gateway,
    deviceIdService,
    httpClient,
    logger,
    getTimeZone,
    sessionEpoch,
  }: PushDeviceServicePorts) {
    this.#gateway = gateway;
    this.#deviceIdService = deviceIdService;
    this.#httpClient = httpClient;
    this.#logger = logger;
    this.#getTimeZone = getTimeZone;
    this.#sessionEpoch = sessionEpoch;
  }

  getPermission = async (): Promise<PushPermission> =>
    toPushPermission(await this.#gateway.getPermission());

  /** 시스템 권한 창을 띄우고, 바뀐 권한을 바로 서버에 알린다 */
  requestPermission = async (): Promise<PushPermission> => {
    const permission = toPushPermission(await this.#gateway.requestPermission());
    this.#logger.info(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUESTED, { ...permission });

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

  /** 이 기기의 권한과 토큰을 서버에 알린다 */
  report = (options: { force?: boolean } = {}): Promise<Result<PushDevice | null, ApiError>> => {
    const reporting = this.#report(options);
    this.#reportsInFlight.add(reporting);
    return reporting.finally(() => {
      this.#reportsInFlight.delete(reporting);
    });
  };

  #report = async ({
    force = false,
  }: {
    force?: boolean;
  }): Promise<Result<PushDevice | null, ApiError>> => {
    const epoch = this.#sessionEpoch.current();
    const unregisterCount = this.#unregisterCount;
    const permission = await this.getPermission();
    const token = PushPermissionPolicy.isPushDeliverable(permission)
      ? await this.#issueToken()
      : null;
    const deviceId = await this.#deviceIdService.get();
    const input = toReportPushDeviceInput({ permission, token });
    const timeZone = this.#getTimeZone();

    const lastReported = this.#lastReported;
    const isSameReport =
      lastReported != null &&
      isEqual(
        { deviceId, input, timeZone },
        {
          deviceId: lastReported.deviceId,
          input: lastReported.input,
          timeZone: lastReported.timeZone,
        },
      );
    if (!force && lastReported != null && isSameReport) {
      return ok(lastReported.device);
    }

    // 읽는 사이 로그아웃했다면 끝난 세션의 기기를 다시 등록하지 않는다
    if (this.#sessionEpoch.current() !== epoch || this.#unregisterCount !== unregisterCount) {
      return ok(null);
    }

    const result = parseApiResponse(
      await this.#httpClient.put(`v1/notifications/push-devices/${deviceId}`, input),
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
    const epoch = this.#sessionEpoch.current();
    this.#unregisterCount += 1;
    await withTimeout(
      () => Promise.allSettled(this.#reportsInFlight),
      config?.timeout ?? REPORT_WAIT_TIMEOUT_MS,
    ).catch(noop);
    const deviceId = await this.#deviceIdService.get();
    // 기다리는 사이 세션이 끝나고 다시 로그인했다면 같은 기기의 등록은 새 세션의 것이라 지우지 않는다
    if (this.#sessionEpoch.current() !== epoch) {
      return ok(undefined);
    }
    this.#lastReported = null;
    const result = await this.#httpClient.delete('v1/notifications/token', {
      ...config,
      params: { deviceId },
    });

    if (!result.ok) {
      return result;
    }

    return ok(undefined);
  };

  #issueToken = async (): Promise<string | null> => {
    try {
      return await this.#gateway.getToken();
    } catch (error) {
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_TOKEN_ISSUE_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    }
  };
}
