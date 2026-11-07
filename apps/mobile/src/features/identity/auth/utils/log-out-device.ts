import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { RequestConfig } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage } from '@src/shared/errors';

import type { AuthService } from '../apis/auth.service';
import type { SessionRevocationService } from '../apis/session-revocation.service';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

/** 로그아웃 서버 요청 하나의 상한. 기본 10초를 두 번 기다리지 않게 짧게 끊는다 */
export const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

interface LogOutDeviceParams {
  isOnline: boolean;
  authService: Pick<AuthService, 'logout' | 'clearLocalSession'>;
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  pushDeviceService: {
    unregister(config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>>;
  };
  tokenStore: Pick<TokenStore, 'readRefreshToken'>;
  sessionRevocationService: Pick<SessionRevocationService, 'record'>;
  sessionEpoch: Pick<SessionEpoch, 'current'>;
  logger: Logger;
}

/** `superseded`면 기다리는 사이 다시 로그인했다. 지금 세션은 사용자가 나간 세션이 아니다 */
type LogOutOutcome = 'ended' | 'superseded';

/**
 * 이 기기의 세션을 끝낸다. 서버 정리(푸시 토큰 해제·로그아웃)는 최선 노력이라
 * 실패하거나 오프라인이어도 토큰은 항상 지운다.
 * 서버에 닿지 못했으면 세션과 푸시 기기가 서버에 남으므로 온라인이 되면 풀도록 기록한다.
 * 서버를 기다리는 동안 세션이 만료되면 세대가 오른다. 그 뒤의 인증 요청과 토큰 삭제는 다음 세션을 끝낼 수 있어 하지 않는다.
 */
export async function logOutDevice({
  isOnline,
  authService,
  pushDeviceService,
  tokenStore,
  sessionRevocationService,
  sessionEpoch,
  logger,
}: LogOutDeviceParams): Promise<LogOutOutcome> {
  const epoch = sessionEpoch.current();
  const isSameSession = () => sessionEpoch.current() === epoch;

  // 로그아웃이 토큰을 지우고 나면 읽을 수 없어 먼저 읽어 둔다
  const refreshToken = await tokenStore.readRefreshToken().catch((error: unknown) => {
    logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_NOT_RECORDED, { error: getErrorMessage(error) });
    return null;
  });

  const recordRevocation = async () => {
    if (refreshToken == null) {
      return;
    }
    await sessionRevocationService.record(refreshToken).catch((error: unknown) => {
      logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_NOT_RECORDED, {
        error: getErrorMessage(error),
      });
    });
  };

  const finish = async (): Promise<LogOutOutcome> => {
    if (isSameSession()) {
      await authService.clearLocalSession().catch((error: unknown) => {
        logger.warn(AUTH_LOG_EVENT.LOCAL_SESSION_CLEAR_FAILED, { error: getErrorMessage(error) });
      });
      return 'ended';
    }
    // 만료가 토큰을 먼저 지웠다. 저장소에 토큰이 있으면 새 세션의 것이고, 읽지 못하면 새 세션일 수 있어 끝내지 않는다
    return tokenStore.readRefreshToken().then(
      (nextRefreshToken) => (nextRefreshToken == null ? 'ended' : 'superseded'),
      () => 'superseded',
    );
  };

  if (!isOnline) {
    logger.info(AUTH_LOG_EVENT.LOGOUT_SERVER_SKIPPED_OFFLINE);
    await recordRevocation();
    return finish();
  }

  const config = { timeout: LOGOUT_REQUEST_TIMEOUT_MS };

  try {
    const unregisterResult = await pushDeviceService.unregister(config);
    if (!unregisterResult.ok) {
      logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_SKIPPED, { code: unregisterResult.error.code });
    }
  } catch (error) {
    logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_FAILED, { error: getErrorMessage(error) });
  }

  if (!isSameSession()) {
    await recordRevocation();
    return finish();
  }

  try {
    const result = await authService.logout(config);
    if (!result.ok) {
      logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { code: result.error.code });
    }
  } catch (error) {
    logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: getErrorMessage(error) });
    await recordRevocation();
  }

  return finish();
}
