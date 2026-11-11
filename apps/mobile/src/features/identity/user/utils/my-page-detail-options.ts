import type { NativeStackNavigationOptions } from 'expo-router';

interface StackScreenOptionsInput {
  route: { key?: string; name: string };
  navigation: { getState: () => { routes: readonly { key: string }[] } };
}

const DETAIL_ROOT_OPTIONS = {
  headerBackVisible: false,
  gestureEnabled: false,
  animation: 'none',
} as const satisfies NativeStackNavigationOptions;

// 메뉴 칸이 화면마다 같은 자리에 있어 밀어 넣지 않고 겹쳐 바꿔야 상세만 바뀌어 보인다
const STACKED_DETAIL_OPTIONS = {
  animation: 'fade',
  animationMatchesGesture: true,
} as const satisfies NativeStackNavigationOptions;

/** 메뉴가 쌓인 화면을 걷고 바로 연 화면의 경로. 걷기와 열기가 한 번에 반영돼 옵션을 처음 계산할 때는 걷기 전 상태만 보인다 */
let requestedDetailRootPathname: string | null = null;

/** 넓은 화면 메뉴가 쌓인 상세를 걷고 새 첫 상세를 열기 직전에 부른다 */
export function requestMyPageDetailRoot(pathname: string) {
  requestedDetailRootPathname = pathname;
}

/** 같은 경로를 더 깊이 다시 열 때 첫 상세로 잘못 보지 않게 이동이 반영된 뒤 지운다 */
export function clearMyPageDetailRootRequest() {
  requestedDetailRootPathname = null;
}

function isRequestedRoute(routeName: string) {
  if (requestedDetailRootPathname == null) {
    return false;
  }
  const name = requestedDetailRootPathname.replace(/^\//, '');
  return routeName === name || routeName === `${name}/index`;
}

/** 넓은 화면의 첫 상세는 메뉴가 고른 화면이라 뒤로 가기 없이 바꾸고 두 번째부터 네이티브 뒤로 가기를 쓴다. 쌓는 렌더에서 받은 상태에 그 화면이 없으면 맨 뒤에 붙을 자리로 본다 */
export function getMyPageDetailOptions({
  route,
  navigation,
}: StackScreenOptionsInput): NativeStackNavigationOptions {
  const { routes } = navigation.getState();
  const foundIndex = routes.findIndex(({ key }) => key === route.key);
  if (foundIndex === 0) {
    return {};
  }
  const isDetailRoot =
    foundIndex === -1 ? routes.length === 1 || isRequestedRoute(route.name) : foundIndex === 1;

  return isDetailRoot ? DETAIL_ROOT_OPTIONS : STACKED_DETAIL_OPTIONS;
}
