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

  return useCallback(
    (destination: NotificationDestination) => {
      match(destination)
        .with({ kind: 'route' }, ({ href }) => navigate(href))
        .with({ kind: 'webview' }, ({ url }) => void openUrl(url))
        .with({ kind: 'browser' }, ({ url }) => void Linking.openURL(url))
        .with({ kind: 'none' }, () => {})
        .exhaustive();
    },
    [navigate, openUrl],
  );
}
