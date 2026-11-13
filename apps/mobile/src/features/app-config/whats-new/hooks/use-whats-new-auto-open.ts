import { useApplicationMetadata } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMemo } from 'react';

import { WhatsNewPolicy } from '../domains/whats-new.model';
import { shouldShowCoachmarks } from '../utils/whats-new-coachmarks.view-model';
import { useWhatsNewCampaign } from './use-whats-new-campaign';

interface WhatsNewAutoOpenInput {
  /** 알림 화면을 열 차례가 아니라고 정해졌다. 새로운 기능과 말풍선은 그 뒤에 연다 */
  isOnboardingSettled: boolean;
}

/** 서버가 켠 캠페인을 이 계정에 자동으로 열 차례인지. 여는 피드와 그 뒤에 띄울 말풍선이 같은 판단을 읽는다 */
export function useWhatsNewAutoOpen({ isOnboardingSettled }: WhatsNewAutoOpenInput) {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { config, isConfigLoading, release, identity, hasSeen } = useWhatsNewCampaign();
  const applicationMetadata = useApplicationMetadata();
  const appVersion = useMemo(
    () => applicationMetadata.getInstallation()?.currentVersion ?? null,
    [applicationMetadata],
  );
  const shouldAutoOpen =
    isAuthenticated &&
    identity != null &&
    release != null &&
    WhatsNewPolicy.shouldAutoOpen(release, { config, appVersion, hasSeen });

  return {
    identity,
    release,
    shouldAutoOpen,
    shouldShowCoachmarks: shouldShowCoachmarks({
      isOnboardingSettled,
      isCampaignConfigLoading: isConfigLoading,
      shouldAutoOpenWhatsNew: shouldAutoOpen,
    }),
  };
}
