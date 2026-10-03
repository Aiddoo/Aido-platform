import { resolveWidgetAppRoute } from '@src/features/widget/presentations/navigation/resolve-widget-app-route';
import { toError } from '@src/shared/errors';
import * as Linking from 'expo-linking';
import { router, useSegments, type Href } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';

import { useAuth } from '../providers/auth-provider';
import { useErrorReporter } from '../providers/di-context';

export function useWidgetAppEntry() {
  const { status } = useAuth();
  const errorReporter = useErrorReporter();
  const segments = useSegments();
  const [pendingRoute, setPendingRoute] = useState<Href | null>(null);
  const handleInitialUrl = useEffectEvent((url: string | null) => {
    if (status === 'unauthenticated') return;
    const route = resolveWidgetAppRoute(url);
    if (!route) return;
    setPendingRoute(route);
    errorReporter.addBreadcrumb({
      category: 'widget',
      message: 'initial widget destination queued',
    });
  });
  const reportInitialUrlError = useEffectEvent((error: unknown) => {
    errorReporter.captureException(toError(error), { feature: 'widget_app_entry' });
  });

  useEffect(() => {
    let isCancelled = false;
    void Linking.getInitialURL()
      .then((url) => {
        if (!isCancelled) handleInitialUrl(url);
      })
      .catch((error: unknown) => {
        if (!isCancelled) reportInitialUrlError(error);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const isAuthenticatedRouteMounted = segments[0] === '(app)';

  useEffect(() => {
    if (status === 'unauthenticated') {
      setPendingRoute(null);
      return;
    }
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted || !pendingRoute) return;

    const frameId = requestAnimationFrame(() => {
      setPendingRoute(null);
      router.replace(pendingRoute);
      errorReporter.addBreadcrumb({
        category: 'widget',
        message: 'initial widget destination restored',
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [status, isAuthenticatedRouteMounted, pendingRoute, errorReporter]);
}
