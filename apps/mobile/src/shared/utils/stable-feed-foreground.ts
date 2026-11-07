import type { AppStateStatus } from 'react-native';

interface StableFeedForegroundInput {
  isAuthenticated: boolean;
  isFocused: boolean;
  appState: AppStateStatus | null;
  isKeyboardVisible: boolean;
  hasActiveOverlay: boolean;
  hasPendingDeepLink: boolean;
  /** 곧 다른 화면으로 넘어갈 일이 남았다. 자동 안내가 그 앞에 끼어들지 않게 한다 */
  hasPendingNavigation: boolean;
}

export function isStableFeedForeground({
  isAuthenticated,
  isFocused,
  appState,
  isKeyboardVisible,
  hasActiveOverlay,
  hasPendingDeepLink,
  hasPendingNavigation,
}: StableFeedForegroundInput): boolean {
  return (
    isAuthenticated &&
    isFocused &&
    appState === 'active' &&
    !isKeyboardVisible &&
    !hasActiveOverlay &&
    !hasPendingDeepLink &&
    !hasPendingNavigation
  );
}
