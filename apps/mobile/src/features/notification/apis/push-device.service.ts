import {
  pushDeviceResponseSchema,
  type ReportPushDeviceInput,
  type UnregisterPushDeviceByTokenInput,
  unregisterPushDeviceByTokenResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { isEqual, noop, withTimeout } from 'es-toolkit';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { EMPTY_PUSH_REGISTRATION } from '../constants/notification.constants';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import type { PushDevice, PushPermission } from '../domains/push-permission.model';
import { type PushRegistration, PushRegistrationPolicy } from '../domains/push-registration.model';
import type { DeviceIdService } from './device-id.service';
import { toPushDevice, toPushPermission, toReportPushDeviceInput } from './push-permission.mapper';
import type { PushRegistrationRepository } from './push-registration.repository';

const REPORT_WAIT_TIMEOUT_MS = 3_000;
const NOT_FOUND_STATUS = 404;
const TOO_MANY_REQUESTS_STATUS = 429;

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
  /** 끝난 세션의 해제는 인증 없이 보낸다. 인증 클라이언트는 401에 지금 세션을 끝낸다 */
  publicHttpClient: Pick<HttpClient, 'post'>;
  registrationRepository: PushRegistrationRepository;
  logger: Logger;
  getTimeZone: () => string;
  sessionEpoch: Pick<SessionEpoch, 'current'>;
}

export class PushDeviceService {
  readonly #gateway: PushNotificationGateway;
  readonly #deviceIdService: Pick<DeviceIdService, 'get'>;
  readonly #httpClient: HttpClient;
  readonly #publicHttpClient: Pick<HttpClient, 'post'>;
  readonly #registrationRepository: PushRegistrationRepository;
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
  #releasing: Promise<void> | null = null;
  /** 새 세션의 보고가 끝난 세션의 해제를 무른 횟수. 가는 중인 해제가 새 등록을 지우지 않게 한다 */
  #releaseCancelCount = 0;

  constructor({
    gateway,
    deviceIdService,
    httpClient,
    publicHttpClient,
    registrationRepository,
    logger,
    getTimeZone,
    sessionEpoch,
  }: PushDeviceServicePorts) {
    this.#gateway = gateway;
    this.#deviceIdService = deviceIdService;
    this.#httpClient = httpClient;
    this.#publicHttpClient = publicHttpClient;
    this.#registrationRepository = registrationRepository;
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
    const issuedToken = isDeliverable ? await this.#issueToken() : null;
    const registration =
      isDeliverable && issuedToken == null
        ? await this.#findRegistration()
        : EMPTY_PUSH_REGISTRATION;
    const token = PushRegistrationPolicy.getReportToken(registration, { permission, issuedToken });
    // 보내지 않은 보고는 다음 복귀·토큰 변경 때 토큰을 다시 받아 보낸다
    if (!PushPermissionPolicy.shouldReportPushDevice(permission, { token })) {
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

    // 끝난 세션의 해제가 가는 중이면 끝난 뒤에 보내 새 등록이 지워지지 않게 한다
    if (this.#releasing != null) {
      await this.#releasing;
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

    // 새 세션이 이 기기를 다시 등록하므로 아직 보내지 못한 끝난 세션의 해제는 버린다
    this.#releaseCancelCount += 1;
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
    await this.#updateRegistration((registration) =>
      PushRegistrationPolicy.recordReported(registration, input.token),
    ).catch((error: unknown) =>
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_REGISTRATION_SAVE_FAILED, {
        error: getErrorMessage(error),
      }),
    );
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

    await this.#updateRegistration(PushRegistrationPolicy.recordReleased).catch((error: unknown) =>
      this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_REGISTRATION_SAVE_FAILED, {
        error: getErrorMessage(error),
      }),
    );
    return ok(undefined);
  };

  /**
   * 온라인 로그아웃 없이 세션이 끝났다. 서버는 끝난 세션의 토큰을 지우지 않아 이 기기로 이전 계정의 푸시가 계속 가므로
   * 기기 id와 토큰으로 푼다. 던지지 않고 화면을 기다리게 하지 않는다
   */
  requestRelease = (): Promise<void> => {
    this.#lastReported = null;
    return this.#updateRegistration((registration) =>
      PushRegistrationPolicy.requestRelease(registration, getNowInstant()),
    ).then(
      () => this.flushRelease(),
      (error: unknown) =>
        this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_REGISTRATION_SAVE_FAILED, {
          error: getErrorMessage(error),
        }),
    );
  };

  /** 던지지 않는다. 연결·서버 장애면 기록을 남겨 다음 연결·복귀 때 다시 보낸다. 겹쳐 불리면 앞 시도 뒤에 한 번 더 본다 */
  flushRelease = (): Promise<void> => {
    const releasing = (this.#releasing ?? Promise.resolve())
      .then(() => this.#release())
      .catch((error: unknown) => {
        this.#logger.info(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_RELEASE_DEFERRED, {
          error: getErrorMessage(error),
        });
      })
      .finally(() => {
        if (this.#releasing === releasing) {
          this.#releasing = null;
        }
      });
    this.#releasing = releasing;
    return releasing;
  };

  #release = async (): Promise<void> => {
    const cancelCount = this.#releaseCancelCount;
    const registration = await this.#registrationRepository.find();
    if (!PushRegistrationPolicy.hasPendingRelease(registration)) {
      return;
    }
    const tokens = PushRegistrationPolicy.getReleaseTokens(registration, {
      currentToken: await this.#issueToken(),
    });
    if (tokens.length === 0) {
      return;
    }
    const deviceId = await this.#deviceIdService.get();
    // 토큰을 받는 사이 새 세션이 보고했다면 그 등록을 지우지 않는다
    if (this.#releaseCancelCount !== cancelCount) {
      return;
    }
    const results = await Promise.all(
      tokens.map((token) => this.#postRelease({ deviceId, token })),
    );
    if (results.includes('retry')) {
      throw new Error('push device release throttled');
    }
    if (this.#releaseCancelCount === cancelCount) {
      await this.#updateRegistration(PushRegistrationPolicy.recordReleased);
    }
  };

  /** 연결·서버 장애는 던진다. 429면 다시 보내고, 이 API가 없는 이전 서버(404)는 다시 보내도 같아 조용히 끝낸다 */
  #postRelease = async (input: UnregisterPushDeviceByTokenInput): Promise<'done' | 'retry'> => {
    const result = parseApiResponse(
      await this.#publicHttpClient.post('v1/notifications/push-devices/unregister', input),
      unregisterPushDeviceByTokenResponseSchema,
      noop,
      '[PushDeviceService] Invalid unregisterPushDeviceByToken response',
    );
    if (result.ok || result.error.status === NOT_FOUND_STATUS) {
      return 'done';
    }
    if (result.error.status === TOO_MANY_REQUESTS_STATUS) {
      return 'retry';
    }
    this.#logger.warn(NOTIFICATION_LOG_EVENT.PUSH_DEVICE_RELEASE_REJECTED, {
      errorCode: result.error.code,
    });
    return 'done';
  };

  #findRegistration = (): Promise<PushRegistration> =>
    this.#registrationRepository.find().catch(() => EMPTY_PUSH_REGISTRATION);

  #updateRegistration = async (
    update: (registration: PushRegistration) => PushRegistration,
  ): Promise<void> => {
    await this.#registrationRepository.save(update(await this.#registrationRepository.find()));
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
