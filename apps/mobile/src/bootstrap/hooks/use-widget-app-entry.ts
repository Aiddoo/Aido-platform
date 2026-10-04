import { resolveWidgetAppRoute } from '@src/features/widget/presentations/navigation/resolve-widget-app-route';
import { useLinkingURL } from 'expo-linking';
import { router, useSegments, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../providers/auth-provider';
import { useErrorReporter } from '../providers/di-context';

export function useWidgetAppEntry() {
  const { status } = useAuth();
  const errorReporter = useErrorReporter();
  const segments = useSegments();
  const url = useLinkingURL();
  const previousUrlRef = useRef(url);
  const [pendingRoute, setPendingRoute] = useState<Href | null>(() => resolveWidgetAppRoute(url));
  const isAuthenticatedRouteMounted = segments[0] === '(app)';

  useEffect(() => {
    if (previousUrlRef.current === url) return;
    previousUrlRef.current = url;
    if (
      status === 'unauthenticated' ||
      (status === 'authenticated' && isAuthenticatedRouteMounted)
    ) {
      setPendingRoute(null);
      return;
    }
    setPendingRoute(resolveWidgetAppRoute(url));
  }, [url, status, isAuthenticatedRouteMounted]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setPendingRoute(null);
      return;
    }
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted || !pendingRoute) return;

    const frameId = requestAnimationFrame(() => {
      setPendingRoute(null);
      router.navigate(pendingRoute, { withAnchor: true });
      errorReporter.addBreadcrumb({
        category: 'widget',
        message: 'initial widget destination restored',
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [status, isAuthenticatedRouteMounted, pendingRoute, errorReporter]);
}
