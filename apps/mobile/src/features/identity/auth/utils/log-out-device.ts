import type { Logger } from '@src/core/ports/logger';
import type { TokenStore } from '@src/core/ports/token-store';
import type { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { getErrorMessage } from '@src/shared/errors';

import type { AuthService } from '../apis/auth.service';
import type { SessionRevocationService } from '../apis/session-revocation.service';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

/** 로그아웃 서버 요청 하나의 상한. 기본 10초를 두 번 기다리지 않게 짧게 끊는다 */
export const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

interface LogOutDeviceParams {
  isOnline: boolean;
  authService: Pick<AuthService, 'logout' | 'clearLocalSession'>;
  pushDeviceService: Pick<PushDeviceService, 'unregister'>;
  tokenStore: Pick<TokenStore, 'readRefreshToken'>;
  sessionRevocationService: Pick<SessionRevocationService, 'record'>;
  logger: Logger;
}

/**
 * 이 기기의 세션을 끝낸다. 서버 정리(푸시 토큰 해제·로그아웃)는 최선 노력이라
 * 실패하거나 오프라인이어도 토큰은 항상 지운다.
 * 서버에 닿지 못했으면 세션과 푸시 기기가 서버에 남으므로 온라인이 되면 풀도록 기록한다.
 */
export async function logOutDevice({
  isOnline,
  authService,
  pushDeviceService,
  tokenStore,
  sessionRevocationService,
  logger,
}: LogOutDeviceParams): Promise<void> {
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

  if (!isOnline) {
    logger.info(AUTH_LOG_EVENT.LOGOUT_SERVER_SKIPPED_OFFLINE);
    await recordRevocation();
    await authService.clearLocalSession();
    return;
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

  try {
    const result = await authService.logout(config);
    if (!result.ok) {
      logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { code: result.error.code });
    }
  } catch (error) {
    logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: getErrorMessage(error) });
    await recordRevocation();
  }
}
