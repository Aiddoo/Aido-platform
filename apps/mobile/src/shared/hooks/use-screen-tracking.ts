import { useAnalytics, useErrorReporter } from '@src/shared/di/shared-di-context';
import { toScreenName } from '@src/shared/utils/to-screen-name';
import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

/** 이름은 라우트 템플릿이라 id·초대 코드가 남지 않는다 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const screenName = toScreenName(useSegments());
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const prevPathname = useRef<string | null>(null);
  const prevScreen = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevPathname.current) {
      return;
    }
    const from = prevScreen.current;
    prevPathname.current = pathname;
    prevScreen.current = screenName;

    analytics.trackScreenView(screenName);
    errorReporter.addBreadcrumb({
      category: 'navigation',
      message: '화면 이동',
      data: { from, to: screenName },
    });
  }, [pathname, screenName, analytics, errorReporter]);
}
