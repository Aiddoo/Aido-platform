import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-provider';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

const normalizePathname = (pathname: string): string => pathname.replace(/\/\([^)]+\)/g, '') || '/';

export const useScreenTracking = (): void => {
  const pathname = usePathname();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const prevScreen = useRef<string | null>(null);

  useEffect(() => {
    const screenName = normalizePathname(pathname);
    if (screenName === prevScreen.current) return;
    const from = prevScreen.current;
    prevScreen.current = screenName;

    // 제품 지표(Analytics) + Sentry 내비게이션 breadcrumb(에러 발생 시 화면 이동 경로 확인용)
    analytics.trackScreenView(screenName);
    errorReporter.addBreadcrumb({
      category: 'navigation',
      message: '화면 이동',
      data: { from, to: screenName },
    });
  }, [pathname, analytics, errorReporter]);
};
