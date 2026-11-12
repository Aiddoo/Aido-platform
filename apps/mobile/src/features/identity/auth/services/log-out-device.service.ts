import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { RequestConfig } from '@src/core/ports/http-client';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage } from '@src/shared/errors';

import type { AuthApi } from '../apis/auth.api';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import type { SessionRevocationService } from './session-revocation.service';

/** 로그아웃 서버 요청 하나의 상한. 기본 10초를 두 번 기다리지 않게 짧게 끊는다 */
export const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

interface LogOutDeviceServicePorts {
  authApi: Pick<AuthApi, 'logout'>;
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  pushRegistrationService: {
    unregister(config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>>;
    /** 인증 해제를 보내지 못했을 때 기기 id와 토큰으로 나중에 푼다 */
    requestRelease(): void;
  };
  /** 세션 만료(`SessionManager.end`)와 탈퇴 말고 토큰을 지우는 유일한 경로다 */
  tokenStore: Pick<TokenStore, 'getRefreshToken' | 'clear'>;
  sessionRevocationService: Pick<SessionRevocationService, 'record'>;
  sessionEpoch: Pick<SessionEpoch, 'current'>;
  logger: AppLogger;
}

/** `superseded`면 기다리는 사이 다시 로그인했다. 지금 세션은 사용자가 나간 세션이 아니다 */
type LogOutOutcome = 'ended' | 'superseded';

/** 서버 정리는 최선 노력이라 실패해도 토큰은 지운다. 기다리는 사이 세대가 오르면 다음 세션을 끝낼 수 있어 멈춘다 */
export class LogOutDeviceService {
  readonly #authApi: LogOutDeviceServicePorts['authApi'];
  readonly #pushRegistrationService: LogOutDeviceServicePorts['pushRegistrationService'];
  readonly #tokenStore: LogOutDeviceServicePorts['tokenStore'];
  readonly #sessionRevocationService: LogOutDeviceServicePorts['sessionRevocationService'];
  readonly #sessionEpoch: LogOutDeviceServicePorts['sessionEpoch'];
  readonly #logger: LogOutDeviceServicePorts['logger'];

  constructor({
    authApi,
    pushRegistrationService,
    tokenStore,
    sessionRevocationService,
    sessionEpoch,
    logger,
  }: LogOutDeviceServicePorts) {
    this.#authApi = authApi;
    this.#pushRegistrationService = pushRegistrationService;
    this.#tokenStore = tokenStore;
    this.#sessionRevocationService = sessionRevocationService;
    this.#sessionEpoch = sessionEpoch;
    this.#logger = logger;
  }

  logOut = async ({ isOnline }: { isOnline: boolean }): Promise<LogOutOutcome> => {
    const epoch = this.#sessionEpoch.current();
    const isSameSession = () => this.#sessionEpoch.current() === epoch;

    // 로그아웃이 토큰을 지우고 나면 읽을 수 없어 먼저 읽어 둔다
    const refreshToken = await this.#tokenStore.getRefreshToken().catch((error: unknown) => {
      this.#logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_NOT_RECORDED, {
        error: getErrorMessage(error),
      });
      return null;
    });

    const recordRevocation = async () => {
      if (refreshToken == null) {
        return;
      }
      await this.#sessionRevocationService.record(refreshToken).catch((error: unknown) => {
        this.#logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_NOT_RECORDED, {
          error: getErrorMessage(error),
        });
      });
    };

    let isPushUnregistered = false;
    // 끝난 세션의 기기 해제는 공개 API로 연결될 때 보낸다. 다시 로그인했다면 새 세션의 등록이라 풀지 않는다
    const releasePushIfStillRegistered = (outcome: LogOutOutcome): LogOutOutcome => {
      if (outcome === 'ended' && !isPushUnregistered) {
        try {
          this.#pushRegistrationService.requestRelease();
        } catch (error) {
          this.#logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_FAILED, {
            error: getErrorMessage(error),
          });
        }
      }
      return outcome;
    };

    const finish = async (): Promise<LogOutOutcome> => {
      if (isSameSession()) {
        await this.#tokenStore.clear().catch((error: unknown) => {
          this.#logger.warn(AUTH_LOG_EVENT.LOCAL_SESSION_CLEAR_FAILED, {
            error: getErrorMessage(error),
          });
        });
        return 'ended';
      }
      // 만료가 토큰을 먼저 지웠다. 저장소에 토큰이 있으면 새 세션의 것이고, 읽지 못하면 새 세션일 수 있어 끝내지 않는다
      return this.#tokenStore.getRefreshToken().then(
        (nextRefreshToken) => (nextRefreshToken == null ? 'ended' : 'superseded'),
        () => 'superseded',
      );
    };

    if (!isOnline) {
      this.#logger.info(AUTH_LOG_EVENT.LOGOUT_SERVER_SKIPPED_OFFLINE);
      await recordRevocation();
      return releasePushIfStillRegistered(await finish());
    }

    const config = { timeout: LOGOUT_REQUEST_TIMEOUT_MS };

    try {
      const unregisterResult = await this.#pushRegistrationService.unregister(config);
      isPushUnregistered = unregisterResult.ok;
      if (!unregisterResult.ok) {
        this.#logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_SKIPPED, {
          code: unregisterResult.error.code,
        });
      }
    } catch (error) {
      this.#logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_FAILED, { error: getErrorMessage(error) });
    }

    if (!isSameSession()) {
      await recordRevocation();
      return releasePushIfStillRegistered(await finish());
    }

    try {
      const result = await this.#authApi.logout(config);
      if (!result.ok) {
        this.#logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { code: result.error.code });
      }
    } catch (error) {
      this.#logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: getErrorMessage(error) });
      await recordRevocation();
    }

    return releasePushIfStillRegistered(await finish());
  };
}
