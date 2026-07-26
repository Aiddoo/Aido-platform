import type { AppStateStatus } from 'react-native';

interface StableFeedForegroundInput {
  isAuthenticated: boolean;
  isFocused: boolean;
  appState: AppStateStatus;
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

interface ClaimAndOpenFeatureDiscoveryInput {
  canAutoOpen: boolean;
  isStable: boolean;
  claim: () => boolean;
  open: () => void;
}

export function claimAndOpenFeatureDiscovery({
  canAutoOpen,
  isStable,
  claim,
  open,
}: ClaimAndOpenFeatureDiscoveryInput): boolean {
  if (!canAutoOpen || !isStable || !claim()) {
    return false;
  }

  open();
  return true;
}
