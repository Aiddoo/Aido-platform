import type { AppStateStatus } from 'react-native';

interface StableFeedForegroundInput {
  isAuthenticated: boolean;
  isFocused: boolean;
  appState: AppStateStatus | null;
  isKeyboardVisible: boolean;
  hasActiveOverlay: boolean;
  hasPendingDeepLink: boolean;
}

export function isStableFeedForeground({
  isAuthenticated,
  isFocused,
  appState,
  isKeyboardVisible,
  hasActiveOverlay,
  hasPendingDeepLink,
}: StableFeedForegroundInput): boolean {
  return (
    isAuthenticated &&
    isFocused &&
    appState === 'active' &&
    !isKeyboardVisible &&
    !hasActiveOverlay &&
    !hasPendingDeepLink
  );
}
