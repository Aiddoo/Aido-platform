import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { type ReleaseId, WhatsNewPolicy } from '../domains/whats-new.model';

/**
 * 서버 캠페인이 가리키는 출시를 이 계정이 아직 보지 않았으면 그 id. 메뉴 점과 목록의 새 기능 표시가 이 값 하나를 본다.
 * 본 기록을 구독해 소개를 보고 돌아오면 바로 사라진다
 */
export function useUnseenCampaignReleaseId(): ReleaseId | null {
  const repository = useWhatsNewRepository();
  const isAuthenticated = useAuthStatus() === 'authenticated';
  const { data: config } = useQuery({
    ...useGetFeatureCampaignConfigQueryOptions(),
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

  return release == null || hasSeen ? null : release.id;
}
