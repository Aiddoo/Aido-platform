import { useAppLifecycle } from '@src/shared/di/shared-di-context';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';

/** 꾸밈 애니메이션(프레임 콜백·`withRepeat`)을 켜고 끄는 하나의 조건. 값을 모으는 일은 멈추지 않도록 `useIsAppInBackground`를 쓴다 */
export function useIsAnimationActive(): boolean {
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
