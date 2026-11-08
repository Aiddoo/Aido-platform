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
import type { PushDevice, PushPermission } from '../schemas/push-permission.schema';
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
   * 권한과 토큰을 읽는 동안도 진행 중으로 잡아 해제가 기다리게 하고, 그사이 세션이 끝났으면 보내지 않는다.
   */
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
    // 보고가 해제보다 늦게 도착하면 로그아웃한 기기로 푸시가 다시 간다. 진행 중인 보고를 먼저 끝낸다.
    // 토큰 발급이 느려도 로그아웃을 붙잡지 않게 기다리는 시간은 요청 제한과 같게 둔다
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

  /** 오프라인·APNs 없는 시뮬레이터·Play 서비스 없는 에뮬레이터에서는 null이다. 권한 상태는 토큰 없이도 보고한다 */
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
