import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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
  const isReducedMotion = useReducedMotion();
  return isFocused && isAppActive && !isReducedMotion;
}
