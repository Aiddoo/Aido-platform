import type { NativeStackNavigationOptions } from 'expo-router';

interface StackScreenOptionsInput {
  route: { key?: string };
  navigation: { getState: () => { routes: readonly { key: string }[] } };
}

const SPLIT_DETAIL_ROOT_OPTIONS = {
  headerBackVisible: false,
  gestureEnabled: false,
  // 옆 목록에서 고르면 칸 안의 내용만 바뀌므로 밀려 들어오지 않게 한다
  animation: 'none',
} as const satisfies NativeStackNavigationOptions;

/** 넓은 화면 오른쪽 칸의 첫 상세는 왼쪽 목록이 고른 화면이라 뒤로 가기를 두지 않는다. 두 번째 단계부터는 네이티브 뒤로 가기를 쓴다 */
export function getSplitDetailRootOptions({
  route,
  navigation,
}: StackScreenOptionsInput): NativeStackNavigationOptions {
  const [, detailRoot] = navigation.getState().routes;

  return route.key != null && detailRoot?.key === route.key ? SPLIT_DETAIL_ROOT_OPTIONS : {};
}
