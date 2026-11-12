import { useExternalLink } from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import type { NotificationTarget } from '../domains/notification.model';
import {
  type NotificationDestination,
  toNotificationDestination,
} from '../utils/notification-destination.view-model';

/** 알림이 열 곳을 지금 창 크기와 보는 사람에 맞춰 정한다. 알림함 목록과 눌린 푸시가 같은 길을 쓴다 */
export function useResolveNotificationDestination() {
  const windowSizeClass = useWindowSizeClass();
  const queryClient = useQueryClient();

  return (target: NotificationTarget): NotificationDestination =>
    toNotificationDestination(target, {
      windowSizeClass,
      viewerId: getCachedMe(queryClient)?.id,
    });
}

export function useOpenNotificationDestination() {
  const externalLink = useExternalLink();
  const openInAppBrowser = useOpenInAppBrowser();

  return async (destination: NotificationDestination): Promise<void> => {
    await match(destination)
      .with({ kind: 'route' }, ({ href }) => router.navigate(href))
      .with({ kind: 'webview' }, ({ url }) => openInAppBrowser(url))
      .with({ kind: 'browser' }, ({ url }) => externalLink.open(url))
      .with({ kind: 'none' }, noop)
      .exhaustive();
  };
}
