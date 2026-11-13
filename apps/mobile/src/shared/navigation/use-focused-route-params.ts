import { useRootNavigationState } from 'expo-router';
import { findFocusedRoute } from 'expo-router/react-navigation';

/**
 * 지금 보이는 화면의 route가 받은 params(경로 조각과 query). 루트 훅이 화면의 `useLocalSearchParams`와 같은 route를 본다.
 * `useGlobalSearchParams`는 focus 경로 상위 route의 params까지 합친다. 상세·초대 환영을 anchor와 함께 열면 상위 route에
 * 그 경로 값(`todoId`·`friendId`)이 붙어, 피드로 돌아와도 남는다
 */
export function useFocusedRouteParams(): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(findFocusedRoute(useRootNavigationState())?.params ?? {}),
  );
}
