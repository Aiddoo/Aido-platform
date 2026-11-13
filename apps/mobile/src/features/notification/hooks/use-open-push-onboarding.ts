import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { usePushOnboardingGuardState } from './use-push-onboarding-guard';

/** 피드가 앞에 자리 잡은 뒤에 연다. 알림 화면이 덮으면 피드가 흔들리지 않고, 답하면 화면이 닫혀 피드로 돌아온다.
 * 피드가 따로 판정하지 않고 앱 화면 묶음이 그린 guard를 따른다. 다시 연 앱에서 권한을 읽은 순간 피드가 먼저 그려져도 guard보다 앞서 열지 않는다 */
export function useOpenPushOnboarding({ isStable }: { isStable: boolean }) {
  const isDue = usePushOnboardingGuardState() === 'open';
  const push = useSingleTap(router.push);

  useEffect(() => {
    if (!isDue || !isStable) {
      return;
    }
    const task = requestIdleCallback(() => push('/onboarding/notifications'));
    return () => cancelIdleCallback(task);
  }, [isDue, isStable, push]);
}
