import { useAppLifecycleState } from '@src/shared/hooks/use-app-lifecycle-state';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useIsFocused } from 'expo-router';

export function useIsWeatherSceneRunning(): boolean {
  const isFocused = useIsFocused();
  const appLifecycleState = useAppLifecycleState();
  const isAppActive = appLifecycleState !== 'background' && appLifecycleState !== 'inactive';
  const isReducedMotion = useIsReduceMotionEnabled();
  return isFocused && isAppActive && !isReducedMotion;
}
