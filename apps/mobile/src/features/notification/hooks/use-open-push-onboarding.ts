import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useIsPushOnboardingDue } from './use-is-push-onboarding-due';

/** 피드가 앞에 자리 잡은 뒤에 연다. 알림 화면이 덮으면 피드가 흔들리지 않고, 답하면 화면이 닫혀 피드로 돌아온다 */
export function useOpenPushOnboarding({ isStable }: { isStable: boolean }) {
  const isDue = useIsPushOnboardingDue();
  const push = useSingleTap(router.push);

  useEffect(() => {
    if (!isDue || !isStable) {
      return;
    }
    const task = requestIdleCallback(() => push('/onboarding/notifications'));
    return () => cancelIdleCallback(task);
  }, [isDue, isStable, push]);
}
