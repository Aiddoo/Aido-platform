import type { NativeStackNavigationOptions } from 'expo-router';

interface StackScreenOptionsInput {
  route: { key?: string; name: string };
  navigation: { getState: () => { routes: readonly { key: string }[] } };
}

const SPLIT_DETAIL_ROOT_OPTIONS = {
  headerBackVisible: false,
  gestureEnabled: false,
  // 옆 목록에서 고르면 칸 안의 내용만 바뀌므로 밀려 들어오지 않게 한다
  animation: 'none',
} as const satisfies NativeStackNavigationOptions;

/** 옆 목록이 쌓인 화면을 걷고 바로 연 화면의 경로. 걷기와 열기가 한 번에 반영돼 옵션을 처음 계산할 때는 걷기 전 상태만 보인다 */
let requestedDetailRootPathname: string | null = null;

/** 넓은 화면 목록이 오른쪽 칸을 걷고 새 첫 상세를 열기 직전에 부른다 */
export function requestSplitDetailRoot(pathname: string) {
  requestedDetailRootPathname = pathname;
}

/** 이동이 반영된 뒤 지운다. 같은 경로를 더 깊이 다시 열 때 첫 상세로 잘못 보지 않게 한다 */
export function clearSplitDetailRootRequest() {
  requestedDetailRootPathname = null;
}

function isRequestedRoute(routeName: string) {
  if (requestedDetailRootPathname == null) {
    return false;
  }
  const name = requestedDetailRootPathname.replace(/^\//, '');
  return routeName === name || routeName === `${name}/index`;
}

/**
 * 넓은 화면 오른쪽 칸의 첫 상세는 왼쪽 목록이 고른 화면이라 뒤로 가기를 두지 않는다. 두 번째 단계부터는 네이티브 뒤로 가기를 쓴다.
 * 화면을 쌓는 렌더에서는 받은 상태에 그 화면이 아직 없다. 그때는 맨 뒤에 붙을 자리로 보되, 목록이 걷고 연 화면은 첫 상세다
 */
export function getSplitDetailRootOptions({
  route,
  navigation,
}: StackScreenOptionsInput): NativeStackNavigationOptions {
  const { routes } = navigation.getState();
  const foundIndex = routes.findIndex(({ key }) => key === route.key);
  const isDetailRoot =
    foundIndex === -1 ? routes.length === 1 || isRequestedRoute(route.name) : foundIndex === 1;

  return isDetailRoot ? SPLIT_DETAIL_ROOT_OPTIONS : {};
}
