import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useGetWhatsNewCampaignQueryOptions } from '../queries/whats-new-campaign.queries';

/**
 * 서버가 켠 캠페인이 가리키는 출시와 이 계정·캠페인의 본 기록. 자동 열기·메뉴 점·목록 표시가 이 조회 하나를 읽는다.
 * 본 기록을 구독해 소개를 보고 돌아오면 바로 바뀐다. 캠페인·계정을 모르면 본 것으로 본다
 */
export function useWhatsNewCampaign() {
  const repository = useWhatsNewRepository();
  const isAuthenticated = useAuthStatus() === 'authenticated';
  // isLoading은 처음 받는 중에만 true다. 실패했거나 오프라인이라 멈추면 false라 말풍선을 붙잡아 두지 않는다
  const { data: config, isLoading: isConfigLoading } = useQuery({
    ...useGetWhatsNewCampaignQueryOptions(),
    enabled: isAuthenticated,
  });
  const userId = useMyAccountId({ isEnabled: isAuthenticated });
  const campaignId = config?.enabled ? config.campaignId : null;
  const release =
    campaignId == null ? null : WhatsNewPolicy.findReleaseByCampaign(RELEASES, campaignId);
  const identity = useMemo(
    () => (userId == null || campaignId == null || release == null ? null : { userId, campaignId }),
    [userId, campaignId, release],
  );
  const hasSeen = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        identity == null ? noop : repository.subscribe(identity, onChange),
      [identity, repository],
    ),
    () => identity == null || repository.hasSeen(identity),
  );

  return { config, isConfigLoading, release, identity, hasSeen };
}
