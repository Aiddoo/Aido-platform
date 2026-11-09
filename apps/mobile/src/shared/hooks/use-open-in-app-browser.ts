import { useExternalLink, useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useRef } from 'react';

import { OPEN_URL_LOG_EVENT } from './open-url-log-events';
import { useSingleTap } from './use-single-tap';

/** 연타와 브라우저가 떠 있는 동안의 호출은 무시한다 (iOS는 두 번째 호출이 실패하고 Android는 탭이 쌓인다) */
export function useOpenInAppBrowser() {
  const externalLink = useExternalLink();
  const logger = useLogger();
  const isBrowserOpenRef = useRef(false);

  return useSingleTap((url: string) => {
    if (isBrowserOpenRef.current) {
      return;
    }
    isBrowserOpenRef.current = true;

    externalLink
      .openInAppBrowser(url)
      .catch(() => externalLink.open(url))
      .catch((error: unknown) =>
        logger.warn(OPEN_URL_LOG_EVENT.BROWSER_OPEN_FAILED, { error: getErrorMessage(error) }),
      )
      .finally(() => {
        isBrowserOpenRef.current = false;
      });
  });
}
