import { useExternalLink, useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useCallback, useRef } from 'react';

import { OPEN_URL_LOG_EVENT } from '../observability/open-url-log-events';
import { useSingleTap } from './use-single-tap';

export function useOpenAppSettings() {
  const externalLink = useExternalLink();
  const logger = useLogger();

  return useCallback(
    () =>
      externalLink
        .openSettings()
        .catch((error: unknown) =>
          logger.warn(OPEN_URL_LOG_EVENT.SETTINGS_OPEN_FAILED, { error: getErrorMessage(error) }),
        ),
    [externalLink, logger],
  );
}

/**
 * 약관·공지 같은 웹 문서를 앱 안 브라우저로 연다.
 * 연타와 브라우저가 떠 있는 동안 들어온 호출은 무시한다. iOS는 두 번째 호출이 실패하고 Android는 탭이 두 개 쌓인다.
 * 앱 안 브라우저를 쓸 수 없으면 기본 브라우저로 열고, 그래도 실패하면 기록만 남긴다.
 */
export function useOpenUrl() {
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
