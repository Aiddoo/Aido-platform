import { useExternalLink } from '@src/bootstrap/providers/di-context';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import type { NotificationDestination } from '../utils/notification-destination';

export function useNotificationNavigation() {
  const externalLink = useExternalLink();
  const openInAppBrowser = useOpenInAppBrowser();

  return useCallback(
    async (destination: NotificationDestination): Promise<void> => {
      await match(destination)
        .with({ kind: 'route' }, ({ href }) => router.navigate(href))
        .with({ kind: 'webview' }, ({ url }) => openInAppBrowser(url))
        .with({ kind: 'browser' }, ({ url }) => externalLink.open(url))
        .with({ kind: 'none' }, noop)
        .exhaustive();
    },
    [externalLink, openInAppBrowser],
  );
}
