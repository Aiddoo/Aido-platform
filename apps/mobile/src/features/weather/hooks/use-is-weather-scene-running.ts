import { useAppLifecycle } from '@src/bootstrap/providers/di-context';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';

export function useIsWeatherSceneRunning(): boolean {
  const isFocused = useIsFocused();
  const appLifecycle = useAppLifecycle();
  const appLifecycleState = useSyncExternalStore(
    appLifecycle.subscribe,
    appLifecycle.getCurrentState,
  );
  const isAppActive = appLifecycleState !== 'background' && appLifecycleState !== 'inactive';
  const isReducedMotion = useIsReduceMotionEnabled();
  return isFocused && isAppActive && !isReducedMotion;
}
