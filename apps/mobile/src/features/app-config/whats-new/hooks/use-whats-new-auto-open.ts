import { useApplicationMetadata, useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useGetWhatsNewCampaignConfigQueryOptions } from '../queries/whats-new-campaign.queries';
import { shouldShowCoachmarks } from '../utils/should-show-coachmarks';

interface WhatsNewAutoOpenInput {
  /** 알림 화면을 열 차례가 아니라고 정해졌다. 새로운 기능과 말풍선은 그 뒤에 연다 */
  isOnboardingSettled: boolean;
}

/** 서버가 켠 캠페인을 이 계정에 자동으로 열 차례인지. 여는 피드와 그 뒤에 띄울 말풍선이 같은 판단을 읽는다 */
export function useWhatsNewAutoOpen({ isOnboardingSettled }: WhatsNewAutoOpenInput) {
  const isAuthenticated = useAuthStatus() === 'authenticated';
  // isLoading은 처음 받는 중에만 true다. 실패했거나 오프라인이라 멈추면 false라 말풍선을 붙잡아 두지 않는다
  const { data: config, isLoading: isConfigLoading } = useQuery({
    ...useGetWhatsNewCampaignConfigQueryOptions(),
    enabled: isAuthenticated,
  });
  const accountId = useMyAccountId({ isEnabled: isAuthenticated });
  const applicationMetadata = useApplicationMetadata();
  const appVersion = useMemo(
    () => applicationMetadata.getInstallation()?.currentVersion,
    [applicationMetadata],
  );
  const repository = useWhatsNewRepository();

  const campaignId = config?.enabled ? config.campaignId : null;
  const release =
    campaignId == null ? null : WhatsNewPolicy.findReleaseByCampaign(RELEASES, campaignId);
  const identity = useMemo(
    () =>
      accountId != null && campaignId != null && release != null
        ? { userId: accountId, campaignId }
        : null,
    [accountId, campaignId, release],
  );
  const hasSeen = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        identity == null ? noop : repository.subscribe(identity, onChange),
      [identity, repository],
    ),
    () => identity != null && repository.hasSeen(identity),
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
