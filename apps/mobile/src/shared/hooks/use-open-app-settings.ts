import { useExternalLink, useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useCallback } from 'react';

import { OPEN_URL_LOG_EVENT } from './open-url-log-events';

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
