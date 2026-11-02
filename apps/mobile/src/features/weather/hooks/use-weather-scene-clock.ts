import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
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

export function useWeatherSceneClock(): boolean {
  const isFocused = useIsFocused();
  const isAppActive = useSyncExternalStore(subscribeAppState, getIsAppActive);
  const isReducedMotion = useReduceMotion();
  return isFocused && isAppActive && !isReducedMotion;
}
