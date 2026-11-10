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

type PushDeviceReport = Pick<ReportedPushDevice, 'deviceId' | 'input' | 'timeZone'>;

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
  #pendingSend: {
    report: PushDeviceReport;
    result: Promise<Result<PushDevice | null, ApiError>>;
  } | null = null;
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

  // 서버는 시간대를 요청 헤더에서 읽어 시간대가 바뀌면 다시 보내고, 읽는 동안도 진행 중으로 잡아 해제가 기다린다
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
    const isDeliverable = PushPermissionPolicy.isPushDeliverable(permission);
    const token = isDeliverable ? await this.#issueToken() : null;
    // 허용된 기기의 token null은 1.15.0 서버가 등록된 토큰을 지운다. 보내지 않고 다음 복귀·토큰 변경 때 다시 받는다
    if (isDeliverable && token == null) {
      return ok(null);
    }
    const deviceId = await this.#deviceIdService.get();
    const input = toReportPushDeviceInput({ permission, token });
    const timeZone = this.#getTimeZone();

    const report: PushDeviceReport = { deviceId, input, timeZone };

    const lastReported = this.#lastReported;
    if (
      !force &&
      lastReported != null &&
      isEqual(report, {
        deviceId: lastReported.deviceId,
        input: lastReported.input,
        timeZone: lastReported.timeZone,
      })
    ) {
      return ok(lastReported.device);
    }

    // 읽는 사이 로그아웃했다면 끝난 세션의 기기를 다시 등록하지 않는다
    if (this.#sessionEpoch.current() !== epoch || this.#unregisterCount !== unregisterCount) {
      return ok(null);
    }

    // 권한 허용 직후 요청 화면과 포그라운드 동기화가 같은 값을 동시에 보내므로, 같은 값이 가는 중이면 그 결과를 쓴다
    const pending = this.#pendingSend;
    if (!force && pending != null && isEqual(pending.report, report)) {
      return pending.result;
    }

    const result = this.#send(report, { permission, hasToken: token != null });
    this.#pendingSend = { report, result };
    return result.finally(() => {
      if (this.#pendingSend?.result === result) {
        this.#pendingSend = null;
      }
    });
  };

  #send = async (
    { deviceId, input, timeZone }: PushDeviceReport,
    { permission, hasToken }: { permission: PushPermission; hasToken: boolean },
  ): Promise<Result<PushDevice | null, ApiError>> => {
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
      hasToken,
      hasActiveToken: device.hasActiveToken,
    });
    return ok(device);
  };

  unregister = async (config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>> => {
    const epoch = this.#sessionEpoch.current();
    this.#unregisterCount += 1;
    // 보고가 해제보다 늦으면 로그아웃한 기기로 푸시가 가므로 먼저 끝내되, 요청 제한만큼만 기다린다
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

  /** 오프라인·APNs 없는 시뮬레이터·Play 서비스 없는 에뮬레이터에서는 null이다 */
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
