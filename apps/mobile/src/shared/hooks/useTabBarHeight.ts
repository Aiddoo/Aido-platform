import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useContext } from 'react';

/**
 * Bottom Tab Bar 높이를 안전하게 반환하는 훅.
 *
 * `expo-router/js-tabs`(구 `@react-navigation/bottom-tabs`)의 `useBottomTabBarHeight()`는
 * `BottomTabBarHeightContext`가 없으면 throw하지만, iOS Liquid Glass 환경에서
 * 사용하는 `NativeTabs`(expo-router/unstable-native-tabs)는 이 context를 제공하지 않는다.
 *
 * - **Android** (`Tabs`): context가 존재하므로 실제 탭바 높이를 반환한다.
 * - **iOS** (`NativeTabs`): context가 없으므로 `0`을 반환한다.
 *   iOS는 네이티브에서 ScrollView content inset을 자동 처리하므로 수동 padding이 불필요하다.
 *
 * @see https://github.com/react-navigation/react-navigation/issues/12958 — NativeTabs에서 useBottomTabBarHeight 미지원
 * @see https://docs.expo.dev/router/advanced/native-tabs/ — NativeTabs 자동 content inset 처리
 */
export function useTabBarHeight(): number {
  const height = useContext(BottomTabBarHeightContext);
  return height ?? 0;
}
