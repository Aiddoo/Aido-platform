import { useAnalytics, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toScreenName } from '@src/shared/utils/screen-name';
import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * 경로가 바뀔 때마다 화면 조회를 남긴다. 이름은 라우트 템플릿(`/todo/[todoId]`)이라 id·초대 코드가 남지 않고,
 * 같은 템플릿의 다른 대상(`/todo/1` → `/todo/2`)으로 옮겨도 경로가 바뀌었으므로 한 번 더 센다.
 */
export const useScreenTracking = (): void => {
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

    // 제품 지표(Analytics) + Sentry 내비게이션 breadcrumb(에러 발생 시 화면 이동 경로 확인용)
    analytics.trackScreenView(screenName);
    errorReporter.addBreadcrumb({
      category: 'navigation',
      message: '화면 이동',
      data: { from, to: screenName },
    });
  }, [pathname, screenName, analytics, errorReporter]);
};
