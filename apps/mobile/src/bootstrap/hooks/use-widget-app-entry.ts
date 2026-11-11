import {
  type WidgetNavigationCommand,
  WidgetNavigationPolicy,
} from '@src/features/device/widget/domains/widget-navigation.model';
import {
  findWidgetRoute,
  isWidgetRouteShown,
} from '@src/features/device/widget/utils/widget-navigation-link';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { feedParamsSchema } from '@src/features/planning/todo/schemas/feed-params.schema';
import { toError } from '@src/shared/errors';
import { useLinkingUrl } from '@src/shared/infra/linking/use-linking-url';
import { useQueryClient } from '@tanstack/react-query';
import { router, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';

import { useErrorReporter, useWidgetNavigationRepository } from '../providers/di-context';

export function useWidgetAppEntry() {
  const status = useAuthStatus();
  const errorReporter = useErrorReporter();
  const widgetNavigationRepository = useWidgetNavigationRepository();
  const queryClient = useQueryClient();
  const accountId = useMyAccountId({ isEnabled: status === 'authenticated' });
  const segments = useSegments();
  const pathname = usePathname();
  const parameters = feedParamsSchema.parse(useGlobalSearchParams());
  const url = useLinkingUrl();
  const pendingCommand = useSyncExternalStore(
    widgetNavigationRepository.subscribe,
    widgetNavigationRepository.findPendingCommand,
    () => null,
  );
  const previousUrlRef = useRef(url);
  const [pendingInitialUrl, setPendingInitialUrl] = useState<string | null>(() =>
    findWidgetRoute(url) ? url : null,
  );
  const isAuthenticatedRouteMounted = segments[0] === '(app)';

  const restoreDestination = useEffectEvent(
    (command: WidgetNavigationCommand | null, destinationUrl: string) => {
      if (status !== 'authenticated' || !isAuthenticatedRouteMounted) {
        return;
      }
      const currentCommand = widgetNavigationRepository.findPendingCommand();
      const isCommandCurrent =
        command == null
          ? currentCommand == null
          : currentCommand != null && WidgetNavigationPolicy.isSameCommand(command, currentCommand);
      if (!isCommandCurrent) {
        return;
      }
      if (command != null) {
        const commandState = WidgetNavigationPolicy.getCommandState(command, {
          userId: getCachedMe(queryClient)?.id ?? null,
          now: Date.now(),
        });
        if (commandState === 'ownerUnknown') {
          return;
        }
        if (commandState !== 'valid') {
          setPendingInitialUrl(null);
          widgetNavigationRepository.clearIfCurrent(command);
          return;
        }
      }

      const destination = findWidgetRoute(destinationUrl);
      if (!destination) {
        return;
      }
      setPendingInitialUrl(null);
      try {
        if (!isWidgetRouteShown(destinationUrl, pathname, parameters)) {
          router.navigate(destination, { withAnchor: true });
        }
        if (command == null) {
          widgetNavigationRepository.removeCorrupted();
        } else {
          widgetNavigationRepository.clearIfCurrent(command);
        }
        errorReporter.addBreadcrumb({
          category: 'widget',
          message: 'initial widget destination restored',
        });
      } catch (error) {
        errorReporter.captureException(toError(error), {
          feature: 'widget',
          method: 'useWidgetAppEntry',
        });
      }
    },
  );

  useEffect(() => {
    if (previousUrlRef.current === url) {
      return;
    }
    previousUrlRef.current = url;
    if (
      status === 'unauthenticated' ||
      (status === 'authenticated' && isAuthenticatedRouteMounted)
    ) {
      // oxlint-disable-next-line react/set-state-in-effect -- 들어온 링크와 인증 상태가 바뀔 때 대기 중인 위젯 링크를 맞춘다
      setPendingInitialUrl(null);
      return;
    }
    setPendingInitialUrl(findWidgetRoute(url) ? url : null);
  }, [url, status, isAuthenticatedRouteMounted]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      // oxlint-disable-next-line react/set-state-in-effect -- 로그아웃하면 대기 중인 위젯 링크를 버린다
      setPendingInitialUrl(null);
      if (pendingCommand == null) {
        widgetNavigationRepository.removeCorrupted();
      } else {
        widgetNavigationRepository.clearIfCurrent(pendingCommand);
      }
      return;
    }

    const commandState =
      pendingCommand == null
        ? null
        : WidgetNavigationPolicy.getCommandState(pendingCommand, {
            userId: accountId,
            now: Date.now(),
          });
    if (pendingCommand != null && commandState === 'stale') {
      setPendingInitialUrl(null);
      widgetNavigationRepository.clearIfCurrent(pendingCommand);
      return;
    }
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted) {
      return;
    }
    if (commandState === 'ownerUnknown') {
      return;
    }
    if (pendingCommand != null && commandState === 'foreign') {
      setPendingInitialUrl(null);
      widgetNavigationRepository.clearIfCurrent(pendingCommand);
      return;
    }

    const destinationUrl = pendingCommand?.uri ?? pendingInitialUrl;
    if (!destinationUrl || !findWidgetRoute(destinationUrl)) {
      widgetNavigationRepository.removeCorrupted();
      return;
    }

    const frameId = requestAnimationFrame(() => restoreDestination(pendingCommand, destinationUrl));
    return () => cancelAnimationFrame(frameId);
  }, [
    status,
    isAuthenticatedRouteMounted,
    pendingInitialUrl,
    pendingCommand,
    accountId,
    widgetNavigationRepository,
  ]);
}
