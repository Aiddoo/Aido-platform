import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import type { NotificationDestination } from '../utils/navigation/notification-destination';

export function useNotificationNavigation() {
  const openUrl = useOpenUrl();

  return useCallback(
    async (destination: NotificationDestination): Promise<void> => {
      await match(destination)
        .with({ kind: 'route' }, ({ href, parentHref }) => {
          if (parentHref == null) {
            router.navigate(href);
            return;
          }
          // 상위 화면과 목적지를 같은 tick에 쌓아 전환 애니메이션은 목적지 한 번만 보인다.
          router.navigate(parentHref);
          router.push(href);
        })
        .with({ kind: 'webview' }, ({ url }) => openUrl(url))
        .with({ kind: 'browser' }, ({ url }) => Linking.openURL(url))
        .with({ kind: 'none' }, () => {})
        .exhaustive();
    },
    [openUrl],
  );
}
