import { useApplicationMetadata, useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

interface WhatsNewFeedInput {
  isStable: boolean;
  isInviteAvailable: boolean;
  /** 가입 직후 안내(알림 화면)를 열 차례가 아니라고 정해졌다. 정해지기 전에 열면 그 화면과 겹치거나 순서가 바뀐다 */
  isOnboardingSettled: boolean;
}

/** 업데이트한 기존 사용자에게 서버가 켠 캠페인을 첫 피드에서 한 번 자동으로 열고, 피드 카드로 다시 열게 한다 */
export function useWhatsNewFeed({
  isStable,
  isInviteAvailable,
  isOnboardingSettled,
}: WhatsNewFeedInput) {
  const status = useAuthStatus();
  const isAuthenticated = status === 'authenticated';
  const { data: config } = useQuery({
    ...useGetFeatureCampaignConfigQueryOptions(),
    enabled: isAuthenticated,
  });
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const applicationMetadata = useApplicationMetadata();
  const appVersion = useMemo(
    () => applicationMetadata.getInstallation()?.currentVersion,
    [applicationMetadata],
  );
  const repository = useWhatsNewRepository();
  const now = useMinuteNow();
  const push = useSingleTap(router.push);

  const campaignRelease = config?.enabled
    ? WhatsNewPolicy.findReleaseByCampaign(RELEASES, config.campaignId)
    : null;
  const release =
    campaignRelease != null && WhatsNewPolicy.canViewRelease(campaignRelease, { isInviteAvailable })
      ? campaignRelease
      : null;
  const accountId = user?.id;
  const identity = useMemo(
    () =>
      accountId != null && release != null
        ? { userId: accountId, campaignId: release.campaignId }
        : null,
    [accountId, release],
  );
  const subscribe = useCallback(
    (onChange: () => void) => (identity == null ? noop : repository.subscribe(identity, onChange)),
    [identity, repository],
  );
  const hasSeen = useSyncExternalStore(subscribe, () =>
    identity == null ? false : repository.hasSeen(identity),
  );
  const reentryOpenedAt = useSyncExternalStore(subscribe, () =>
    identity == null ? null : repository.findReentryOpenedAt(identity),
  );
  const shouldAutoOpen =
    isAuthenticated &&
    identity != null &&
    WhatsNewPolicy.shouldAutoOpen({
      config,
      user,
      appVersion,
      hasSeen,
    });

  useEffect(() => {
    if (
      !shouldAutoOpen ||
      !isStable ||
      !isOnboardingSettled ||
      identity == null ||
      release == null
    ) {
      return;
    }

    const task = requestIdleCallback(() => {
      if (repository.claimSeen(identity, getNowInstant())) {
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'auto' } });
      }
    });

    return () => cancelIdleCallback(task);
  }, [shouldAutoOpen, identity, isStable, isOnboardingSettled, push, release, repository]);

  const isReentryVisible =
    identity != null && WhatsNewPolicy.shouldShowReentry(reentryOpenedAt, now);

  const openFromReentry = () => {
    if (release != null) {
      push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'feed_reentry' } });
    }
  };

  const dismissReentry = () => {
    if (identity != null) {
      repository.dismissReentry(identity);
    }
  };

  return { isReentryVisible, openFromReentry, dismissReentry };
}
