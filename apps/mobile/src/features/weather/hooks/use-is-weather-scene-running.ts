import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribeAppState(onChange: () => void) {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}

function getIsAppActive() {
  return AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
}

export function useIsWeatherSceneRunning(): boolean {
  const isFocused = useIsFocused();
  const isAppActive = useSyncExternalStore(subscribeAppState, getIsAppActive);
  const isReducedMotion = useIsReduceMotionEnabled();
  return isFocused && isAppActive && !isReducedMotion;
}
