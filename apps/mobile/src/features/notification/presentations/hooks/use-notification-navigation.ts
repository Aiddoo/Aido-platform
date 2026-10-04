import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import type { NotificationDestination } from '../navigation/notification-destination';

export function useNotificationNavigation() {
  const openUrl = useOpenUrl();

  return useCallback(
    async (destination: NotificationDestination): Promise<void> => {
      await match(destination)
        .with({ kind: 'route' }, ({ href }) => router.navigate(href))
        .with({ kind: 'webview' }, ({ url }) => openUrl(url))
        .with({ kind: 'browser' }, ({ url }) => Linking.openURL(url))
        .with({ kind: 'none' }, () => {})
        .exhaustive();
    },
    [openUrl],
  );
}
