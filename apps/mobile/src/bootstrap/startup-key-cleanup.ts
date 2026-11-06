import type { Logger } from '@src/core/ports/logger';
import { getErrorMessage } from '@src/shared/errors';

const STARTUP_KEY_CLEANUP_FAILED = 'bootstrap.startup-key-cleanup.failed';

/** 키를 쓰는 feature가 지우는 일도 맡는다. 여기는 시작 때 한 번 부르기만 하고, 실패해도 앱을 막지 않는다 */
export function runStartupKeyCleanup(
  cleanups: Record<string, () => void>,
  logger: Pick<Logger, 'warn'>,
): void {
  Object.entries(cleanups).forEach(([step, cleanup]) => {
    try {
      cleanup();
    } catch (error) {
      logger.warn(STARTUP_KEY_CLEANUP_FAILED, { step, error: getErrorMessage(error) });
    }
  });
}
