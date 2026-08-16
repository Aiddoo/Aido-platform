import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import type { NotificationDestination } from '../../models/notification-destination.model';

/**
 * 목적지를 실제 이동으로 옮기는 유일한 자리. 알림 목록과 푸시 탭이 함께 쓴다.
 * 인앱 브라우저는 앱의 다른 화면들과 같은 useOpenUrl을 쓴다.
 */
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
