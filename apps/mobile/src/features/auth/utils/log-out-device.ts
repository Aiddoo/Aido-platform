import type { Logger } from '@src/core/ports/logger';
import type { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { errorMessageOf } from '@src/shared/errors';

import type { AuthService } from '../apis/auth.service';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

/** 로그아웃 서버 요청 하나의 상한. 기본 10초를 두 번 기다리지 않게 짧게 끊는다 */
export const LOGOUT_REQUEST_TIMEOUT_MS = 3_000;

interface LogOutDeviceParams {
  isOnline: boolean;
  authService: Pick<AuthService, 'logout' | 'clearLocalSession'>;
  pushDeviceService: Pick<PushDeviceService, 'unregister'>;
  logger: Logger;
}

/**
 * 이 기기의 세션을 끝낸다. 서버 정리(푸시 토큰 해제·로그아웃)는 최선 노력이라
 * 실패하거나 오프라인이어도 토큰은 항상 지운다.
 */
export const logOutDevice = async ({
  isOnline,
  authService,
  pushDeviceService,
  logger,
}: LogOutDeviceParams): Promise<void> => {
  if (!isOnline) {
    logger.info(AUTH_LOG_EVENT.LOGOUT_SERVER_SKIPPED_OFFLINE);
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
    logger.warn(AUTH_LOG_EVENT.PUSH_UNREGISTER_FAILED, { error: errorMessageOf(error) });
  }

  try {
    const result = await authService.logout(config);
    if (!result.ok) {
      logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { code: result.error.code });
    }
  } catch (error) {
    logger.warn(AUTH_LOG_EVENT.LOGOUT_API_FAILED, { error: errorMessageOf(error) });
  }
};
