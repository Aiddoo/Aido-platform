import type { AppLogger } from '@src/core/ports/app-logger';
import { getErrorMessage } from '@src/shared/errors';

const STARTUP_KEY_CLEANUP_LOG_EVENT = {
  FAILED: 'bootstrap.startup-key-cleanup.failed',
} as const;

/** 키를 쓰는 feature가 지우는 일도 맡는다. 여기는 시작 때 한 번 부르기만 하고, 실패해도 앱을 막지 않는다 */
export function cleanStartupKeys(
  cleanups: Record<string, () => void>,
  logger: Pick<AppLogger, 'warn'>,
): void {
  Object.entries(cleanups).forEach(([step, cleanup]) => {
    try {
      cleanup();
    } catch (error) {
      logger.warn(STARTUP_KEY_CLEANUP_LOG_EVENT.FAILED, { step, error: getErrorMessage(error) });
    }
  });
}
