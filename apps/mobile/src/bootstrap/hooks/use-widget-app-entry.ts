import { WidgetNavigationPolicy } from '@src/features/device/widget/domains/widget-navigation.model';
import { type WidgetNavigationCommand } from '@src/features/device/widget/schemas/widget-navigation.schema';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { feedParamsSchema } from '@src/features/planning/todo/schemas/feed-params.schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLinkingURL } from 'expo-linking';
import { router, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';

import { useErrorReporter, useWidgetNavigationRepository } from '../providers/di-context';

export function useWidgetAppEntry() {
  const status = useAuthStatus();
  const errorReporter = useErrorReporter();
  const widgetNavigationRepository = useWidgetNavigationRepository();
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    ...useGetMeQueryOptions(),
    enabled: status === 'authenticated',
    throwOnError: false,
    select: (user) => user.id,
  });
  const segments = useSegments();
  const pathname = usePathname();
  const parameters = feedParamsSchema.parse(useGlobalSearchParams());
  const url = useLinkingURL();
  const pendingCommand = useSyncExternalStore(
    widgetNavigationRepository.subscribe,
    widgetNavigationRepository.getPendingCommand,
    () => null,
  );
  const previousUrlRef = useRef(url);
  const [pendingInitialUrl, setPendingInitialUrl] = useState<string | null>(() =>
    WidgetNavigationPolicy.getRoute(url) ? url : null,
  );
  const isAuthenticatedRouteMounted = segments[0] === '(app)';

  const restoreDestination = useEffectEvent(
    (command: WidgetNavigationCommand | null, destinationUrl: string) => {
      if (status !== 'authenticated' || !isAuthenticatedRouteMounted) {
        return;
      }
      const currentCommand = widgetNavigationRepository.getPendingCommand();
      if (
        command
          ? currentCommand == null || !WidgetNavigationPolicy.isSameCommand(command, currentCommand)
          : currentCommand != null
      ) {
        return;
      }
      if (command) {
        const currentUserId = getCachedMe(queryClient)?.id;
        if (currentUserId == null) {
          return;
        }
        if (
          !WidgetNavigationPolicy.isOwnedBy(command, currentUserId) ||
          !WidgetNavigationPolicy.isFresh(command, Date.now())
        ) {
          setPendingInitialUrl(null);
          widgetNavigationRepository.clearIfCurrent(command);
          return;
        }
      }

      const destination = WidgetNavigationPolicy.getRoute(destinationUrl);
      if (!destination) {
        return;
      }
      setPendingInitialUrl(null);
      try {
        if (!WidgetNavigationPolicy.isCurrentRoute(destinationUrl, pathname, parameters)) {
          router.navigate(destination, { withAnchor: true });
        }
        widgetNavigationRepository.clearIfCurrent(command);
        errorReporter.addBreadcrumb({
          category: 'widget',
          message: 'initial widget destination restored',
        });
      } catch (error) {
        errorReporter.captureException(error instanceof Error ? error : new Error(String(error)), {
          feature: 'widget',
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
      setPendingInitialUrl(null);
      return;
    }
    setPendingInitialUrl(WidgetNavigationPolicy.getRoute(url) ? url : null);
  }, [url, status, isAuthenticatedRouteMounted]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setPendingInitialUrl(null);
      widgetNavigationRepository.clearIfCurrent(pendingCommand);
      return;
    }

    if (pendingCommand && !WidgetNavigationPolicy.isFresh(pendingCommand, Date.now())) {
      setPendingInitialUrl(null);
      widgetNavigationRepository.clearIfCurrent(pendingCommand);
      return;
    }
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted) {
      return;
    }
    if (pendingCommand && meQuery.data == null) {
      return;
    }
    if (pendingCommand && !WidgetNavigationPolicy.isOwnedBy(pendingCommand, meQuery.data ?? '')) {
      setPendingInitialUrl(null);
      widgetNavigationRepository.clearIfCurrent(pendingCommand);
      return;
    }

    const destinationUrl = pendingCommand?.uri ?? pendingInitialUrl;
    if (!destinationUrl || !WidgetNavigationPolicy.getRoute(destinationUrl)) {
      widgetNavigationRepository.clearIfCurrent(null);
      return;
    }

    const frameId = requestAnimationFrame(() => restoreDestination(pendingCommand, destinationUrl));
    return () => cancelAnimationFrame(frameId);
  }, [
    status,
    isAuthenticatedRouteMounted,
    pendingInitialUrl,
    pendingCommand,
    meQuery.data,
    widgetNavigationRepository,
  ]);
}
