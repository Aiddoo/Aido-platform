import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

/** `app/(app)/(tabs)` 탭 묶음의 route 이름 */
const TABS_ROUTE_NAME = '(tabs)';
const GROUP_SEGMENT = /^\(.+\)$/;
const DYNAMIC_SEGMENT = /^\[[^.[\]]+\]$/;

interface NavigatorState {
  index?: number;
  routeNames?: readonly string[];
  routes: readonly { name: string; state?: NavigatorState }[];
}

interface NavigationContainer {
  isReady(): boolean;
  getRootState(): NavigatorState;
}

interface SelectedTab {
  /** 탭 Stack까지의 그룹 경로(`/(app)/(tabs)/(todos)`) */
  groupPath: string;
  routeNames: readonly string[];
}

// `+native-intent`는 React 밖에서 돌아 훅으로 내비게이션 상태를 읽지 못한다. 루트 레이아웃이 컨테이너를 묶는다
let navigationContainer: NavigationContainer | null = null;

/** 루트 레이아웃에서 한 번 불러 `toSelectedTabPath`가 지금 내비게이션 상태를 읽게 한다 */
export function useBindSelectedTabPath(): void {
  const container = useNavigationContainerRef();

  useEffect(() => {
    navigationContainer = container;
    return () => {
      navigationContainer = null;
    };
  }, [container]);
}

/**
 * 지금 고른 탭의 Stack이 이 경로의 화면을 가지면 그 탭 그룹을 앞에 붙인다(`/friends` → `/(app)/(tabs)/(todos)/friends`).
 * Expo Router는 그룹 없는 경로를 지금 focus route의 그룹으로 고르는데, 탭 밖 route(시트·초대 카드·탭 위 상세)가 focus면
 * 글자 순 첫 탭(마이)을 고른다. 탭 묶음이 없거나(콜드·로그인 전) 그 탭에 없는 화면이면 경로를 그대로 둔다
 */
export function toSelectedTabPath(path: string): string {
  const tab = findSelectedTab(
    navigationContainer?.isReady() ? navigationContainer.getRootState() : undefined,
  );
  if (tab == null) {
    return path;
  }
  const pathSegments = (path.split(/[?#]/, 1)[0] ?? '').split('/').filter(Boolean);
  const isTabScreen = tab.routeNames.some((routeName) => matchesRouteName(routeName, pathSegments));
  return isTabScreen ? `${tab.groupPath}${path}` : path;
}

/** 위에 쌓인 route부터 내려가 탭 묶음을 찾는다. 탭 밖 route가 맨 위여도 그 아래 탭 묶음이 고른 탭이다 */
function findSelectedTab(state: NavigatorState | undefined, groupPath = ''): SelectedTab | null {
  for (const route of [...(state?.routes ?? [])].reverse()) {
    if (route.name === TABS_ROUTE_NAME) {
      const tab = route.state?.routes[route.state.index ?? 0];
      return tab == null
        ? null
        : {
            groupPath: `${groupPath}/${route.name}/${tab.name}`,
            routeNames: tab.state?.routeNames ?? [],
          };
    }
    const found = findSelectedTab(
      route.state,
      GROUP_SEGMENT.test(route.name) ? `${groupPath}/${route.name}` : groupPath,
    );
    if (found != null) {
      return found;
    }
  }
  return null;
}

/** route 이름(`friends/invite/index`·`reports/[reportId]`)이 이 경로 조각의 화면인지 */
function matchesRouteName(routeName: string, pathSegments: readonly string[]): boolean {
  const segments = routeName.split('/').filter((segment) => !GROUP_SEGMENT.test(segment));
  const routeSegments = segments.at(-1) === 'index' ? segments.slice(0, -1) : segments;
  return (
    routeSegments.length === pathSegments.length &&
    routeSegments.every(
      (segment, index) => DYNAMIC_SEGMENT.test(segment) || segment === pathSegments[index],
    )
  );
}
