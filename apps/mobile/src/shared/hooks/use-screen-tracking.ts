import { useAnalytics } from '@src/bootstrap/providers/di-provider';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

const normalizePathname = (pathname: string): string => pathname.replace(/\/\([^)]+\)/g, '') || '/';

export const useScreenTracking = (): void => {
  const pathname = usePathname();
  const analytics = useAnalytics();
  const prevScreen = useRef<string | null>(null);

  useEffect(() => {
    const screenName = normalizePathname(pathname);
    if (screenName === prevScreen.current) return;
    prevScreen.current = screenName;
    analytics.trackScreenView(screenName);
  }, [pathname, analytics]);
};
