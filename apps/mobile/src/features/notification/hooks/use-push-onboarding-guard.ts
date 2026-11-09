import { useEffect, useSyncExternalStore } from 'react';

import { createPushOnboardingGuardStore } from '../utils/push-onboarding-guard-store';
import { useIsPushOnboardingDue } from './use-is-push-onboarding-due';

const pushOnboardingGuard = createPushOnboardingGuardStore();

/** 앱 화면 묶음의 `Stack.Protected` guard. 판정은 여기 한 곳에서 하고, 그려진 뒤에야 피드가 화면을 열 수 있게 알린다 */
export function usePushOnboardingGuard(): boolean {
  const isDue = useIsPushOnboardingDue();

  useEffect(() => {
    pushOnboardingGuard.set(isDue);
    return () => pushOnboardingGuard.set(false);
  }, [isDue]);

  return isDue;
}

/** guard가 열린 채 그려졌을 때만 true다. 이 값으로 열어야 열자마자 guard에 막혀 되돌아가지 않는다 */
export function useIsPushOnboardingGuardOpen(): boolean {
  return useSyncExternalStore(pushOnboardingGuard.subscribe, pushOnboardingGuard.get);
}
