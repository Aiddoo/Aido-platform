import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { RequestConfig } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import type { AuthService } from './auth.service';
import type { SessionRevocationService } from './session-revocation.service';

// 기본 10초를 두 번 기다리지 않게 짧게 끊는다
export const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

interface LogOutDeviceServicePorts {
  authService: Pick<AuthService, 'logout' | 'clearLocalSession'>;
  pushDeviceService: {
    unregister(config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>>;
  };
  tokenStore: Pick<TokenStore, 'getRefreshToken'>;
  sessionRevocationService: Pick<SessionRevocationService, 'record'>;
  sessionEpoch: Pick<SessionEpoch, 'current'>;
  logger: Logger;
}

type LogOutOutcome = 'ended' | 'superseded';

// 세션이 만료되면 세대가 올라 이후 인증 요청과 토큰 삭제는 다음 세션을 끝낼 수 있어 하지 않는다
export class LogOutDeviceService {
  readonly #authService: LogOutDeviceServicePorts['authService'];
  readonly #pushDeviceService: LogOutDeviceServicePorts['pushDeviceService'];
  readonly #tokenStore: LogOutDeviceServicePorts['tokenStore'];
  readonly #sessionRevocationService: LogOutDeviceServicePorts['sessionRevocationService'];
  readonly #sessionEpoch: LogOutDeviceServicePorts['sessionEpoch'];
  readonly #logger: LogOutDeviceServicePorts['logger'];

  constructor({
    authService,
    pushDeviceService,
    tokenStore,
    sessionRevocationService,
    sessionEpoch,
    logger,
  }: LogOutDeviceServicePorts) {
    this.#authService = authService;
    this.#pushDeviceService = pushDeviceService;
    this.#tokenStore = tokenStore;
    this.#sessionRevocationService = sessionRevocationService;
    this.#sessionEpoch = sessionEpoch;
    this.#logger = logger;
  }

  logOut = async ({ isOnline }: { isOnline: boolean }): Promise<LogOutOutcome> => {
    const epoch = this.#sessionEpoch.current();
    const isSameSession = () => this.#sessionEpoch.current() === epoch;

    // 토큰을 지우면 읽을 수 없어 먼저 읽어 둔다
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

    const finish = async (): Promise<LogOutOutcome> => {
      if (isSameSession()) {
        await this.#authService.clearLocalSession().catch((error: unknown) => {
          this.#logger.warn(AUTH_LOG_EVENT.LOCAL_SESSION_CLEAR_FAILED, {
            error: getErrorMessage(error),
          });
        });
        return 'ended';
      }
      // 만료가 토큰을 먼저 지웠다면 저장소 토큰은 새 세션의 것일 수 있어 끝내지 않는다
      return this.#tokenStore.getRefreshToken().then(
        (nextRefreshToken) => (nextRefreshToken == null ? 'ended' : 'superseded'),
        () => 'superseded',
      );
    };

    if (!isOnline) {
      this.#logger.info(AUTH_LOG_EVENT.LOGOUT_SERVER_SKIPPED_OFFLINE);
      await recordRevocation();
      return finish();
    }

    const config = { timeout: LOGOUT_REQUEST_TIMEOUT_MS };

    try {
      const unregisterResult = await this.#pushDeviceService.unregister(config);
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
      return finish();
    }

    try {
      const result = await this.#authService.logout(config);
      if (!result.ok) {
        this.#logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { code: result.error.code });
      }
    } catch (error) {
      this.#logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: getErrorMessage(error) });
      await recordRevocation();
    }

    return finish();
  };
}
