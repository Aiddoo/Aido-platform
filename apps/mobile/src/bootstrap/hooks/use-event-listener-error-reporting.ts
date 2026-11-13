import { setEventListenerErrorHandler } from '@src/core/events/event-channel';
import type { AppLogger } from '@src/core/ports/app-logger';
import { getErrorMessage } from '@src/shared/errors';
import { useEffect } from 'react';

import { EVENT_LISTENER_LOG_EVENT } from './event-listener-log-events';

/** core 이벤트 채널의 리스너 오류를 로그로 남긴다. 한 리스너의 실패는 다른 리스너에게 번지지 않는다 */
export function useEventListenerErrorReporting(logger: Pick<AppLogger, 'warn'>): void {
  useEffect(
    () =>
      setEventListenerErrorHandler((error, channel) => {
        logger.warn(EVENT_LISTENER_LOG_EVENT.LISTENER_FAILED, {
          channel,
          error: getErrorMessage(error),
        });
      }),
    [logger],
  );
}
