import { useLogger } from '@src/bootstrap/providers/di-context';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import type { NotificationDestination } from '../navigation/notification-destination';

export function useNotificationNavigation() {
  const navigate = useSingleTap(router.navigate);
  const openUrl = useOpenUrl();
  const logger = useLogger();

  return useCallback(
    (destination: NotificationDestination) => {
      match(destination)
        .with({ kind: 'route' }, ({ href }) => navigate(href))
        .with({ kind: 'webview' }, ({ url }) => {
          openUrl(url).catch((error) =>
            logger.warn('[Notification] Failed to open in-app URL', { error }),
          );
        })
        .with({ kind: 'browser' }, ({ url }) => {
          Linking.openURL(url).catch((error) =>
            logger.warn('[Notification] Failed to open browser URL', { error }),
          );
        })
        .with({ kind: 'none' }, () => {})
        .exhaustive();
    },
    [logger, navigate, openUrl],
  );
}
