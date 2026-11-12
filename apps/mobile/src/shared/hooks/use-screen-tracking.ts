import { useAnalytics, useErrorReporter } from '@src/shared/di/shared-di-context';
import { type ScreenName, toScreenName } from '@src/shared/utils/to-screen-name';
import { usePathname, useRootNavigationState, useSegments } from 'expo-router';
import { findFocusedRoute } from 'expo-router/react-navigation';
import { useLayoutEffect, useRef } from 'react';

/** 넓은 화면에서 목록 화면 옆 칸에 여는 상세 */
export interface PaneDetailScreen {
  listScreen: ScreenName;
  /** 칸에 연 상세 id를 담는 query 이름. 상세 route의 동적 세그먼트 이름과 같다 */
  param: string;
  /** 좁은 화면이 push하는 상세 route 템플릿. 칸에 연 상세도 이 이름으로 센다 */
  detailScreen: ScreenName;
}

interface ScreenTrackingOptions {
  /** 사용자가 보지 못하고 지나가는 화면. 앱 경로를 아는 bootstrap이 넘긴다 */
  untrackedScreens: ReadonlySet<ScreenName>;
  /** 가드가 지금 막은 루트 route(`(auth)` 등). Expo Router가 그 자리에 Redirect만 그려 안의 화면은 보이지 않는다 */
  guardedRoutes: ReadonlySet<string>;
  paneDetailScreens: readonly PaneDetailScreen[];
}

interface TrackedView {
  /** 같은 보기인지 가르는 경로. 칸에 연 상세는 좁은 화면의 상세 경로(`/todo/8`)라 접어서 상세로 넘겨도 다시 세지 않는다 */
  pathname: string;
  screenName: ScreenName;
  /** 칸에 연 상세면 그 칸을 가진 목록 경로 */
  listPathname: string | null;
}

/** 이름은 라우트 템플릿이라 id·초대 코드가 남지 않는다 */
export function useScreenTracking({
  untrackedScreens,
  guardedRoutes,
  paneDetailScreens,
}: ScreenTrackingOptions): void {
  const pathname = usePathname();
  const segments = useSegments();
  // 전역 params는 focus 경로의 상위 route params까지 합쳐 앞 화면 값(콜드 스타트 링크의 `todoId`)이 남는다. 화면이 읽는 자기 params를 본다
  const focusedParams = findFocusedRoute(useRootNavigationState())?.params;
  const analytics = useAnalytics();
  const errorReporter = useErrorReporter();
  const prevView = useRef<TrackedView | null>(null);
  const screenName = toScreenName(segments);
  // 가드가 바뀌면 묶음 navigator가 먼저 내려가 Redirect가 옮기기 전까지 묶음 첫 화면(`/login`·`/feed`)에 focus가 머문다
  const isGuarded = guardedRoutes.has(segments[0] ?? '');
  const pane = findOpenPane(paneDetailScreens, screenName, focusedParams);
  const viewPathname = pane?.pathname ?? pathname;
  const viewScreenName = pane?.screenName ?? screenName;
  const listPathname = pane == null ? null : pathname;

  // 새 화면의 마운트 효과(진입·노출 이벤트)보다 먼저 보낸다. Firebase가 그 이벤트에 붙이는 화면 이름이 앞 화면이 되지 않는다
  useLayoutEffect(() => {
    // 건너뛴 화면은 앞 화면으로 기억하지 않아 `/feed` → `/` → `/feed` 왕복을 다시 세지 않는다
    if (isGuarded || untrackedScreens.has(screenName)) {
      return;
    }
    const prev = prevView.current;
    prevView.current = { pathname: viewPathname, screenName: viewScreenName, listPathname };
    // 같은 보기(칸의 상세를 접어 상세 화면으로 넘김 포함)와, 칸의 상세를 닫아 줄곧 보이던 목록만 남은 것은 세지 않는다
    if (viewPathname === prev?.pathname || prev?.listPathname === viewPathname) {
      return;
    }

    analytics.trackScreenView(viewScreenName);
    errorReporter.addBreadcrumb({
      category: 'navigation',
      message: '화면 이동',
      data: { from: prev?.screenName ?? null, to: viewScreenName },
    });
  }, [
    isGuarded,
    screenName,
    viewPathname,
    viewScreenName,
    listPathname,
    untrackedScreens,
    analytics,
    errorReporter,
  ]);
}

function findOpenPane(
  paneDetailScreens: readonly PaneDetailScreen[],
  screenName: ScreenName,
  params: object | undefined,
): { pathname: string; screenName: ScreenName } | null {
  const pane = paneDetailScreens.find(({ listScreen }) => listScreen === screenName);
  const id: unknown =
    pane == null ? undefined : new Map(Object.entries(params ?? {})).get(pane.param);
  if (pane == null || typeof id !== 'string' || id === '') {
    return null;
  }
  return {
    pathname: pane.detailScreen.replace(`[${pane.param}]`, encodeURIComponent(id)),
    screenName: pane.detailScreen,
  };
}
