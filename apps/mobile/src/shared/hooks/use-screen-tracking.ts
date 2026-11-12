import { useAnalytics, useErrorReporter } from '@src/shared/di/shared-di-context';
import type { ScreenName } from '@src/shared/utils/to-screen-name';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useScreenName } from './use-screen-name';

interface ScreenTrackingOptions {
  /** 사용자가 보지 못하고 지나가는 화면. 앱 경로를 아는 bootstrap이 넘긴다 */
  untrackedScreens: ReadonlySet<ScreenName>;
}

/** 이름은 라우트 템플릿이라 id·초대 코드가 남지 않는다 */
export function useScreenTracking({ untrackedScreens }: ScreenTrackingOptions): void {
  const pathname = usePathname();
  const screenName = useScreenName();
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const prevPathname = useRef<string | null>(null);
  const prevScreen = useRef<string | null>(null);

  useEffect(() => {
    // 건너뛴 화면은 앞 화면으로 기억하지 않아 `/feed` → `/` → `/feed` 왕복을 다시 세지 않는다
    if (untrackedScreens.has(screenName) || pathname === prevPathname.current) {
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
  }, [pathname, screenName, untrackedScreens, analytics, errorReporter]);
}
