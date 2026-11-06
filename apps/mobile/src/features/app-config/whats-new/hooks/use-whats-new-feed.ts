import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { toInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useReducer } from 'react';

import { getNativeAppVersion } from '../apis/native-app-version';
import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

interface WhatsNewFeedInput {
  /** 날씨 위치 안내가 뜰 수 있는 동안에는 자동으로 열지 않아 두 안내가 겹치지 않게 한다 */
  isWeatherIntroductionPending: boolean;
  isInviteAvailable: boolean;
}

/** 서버가 켠 캠페인을 처음 한 번 자동으로 열고, 14일 동안 피드 카드로 다시 열게 한다 */
export function useWhatsNewFeed({
  isWeatherIntroductionPending,
  isInviteAvailable,
}: WhatsNewFeedInput) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const { data: config } = useQuery({
    ...useGetFeatureCampaignConfigQueryOptions(),
    enabled: isAuthenticated,
  });
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const appVersion = useMemo(getNativeAppVersion, []);
  const isStable = useStableFeedForeground();
  const repository = useWhatsNewRepository();
  const now = toInstant(useMinuteNow().toISOString());
  const push = useSingleTap(router.push);
  const [, refreshState] = useReducer((count: number) => count + 1, 0);

  const campaignRelease = config?.enabled
    ? WhatsNewPolicy.findReleaseByCampaign(RELEASES, config.campaignId)
    : undefined;
  const release =
    campaignRelease != null &&
    WhatsNewPolicy.isReleaseAvailable(campaignRelease, { isInviteAvailable })
      ? campaignRelease
      : undefined;
  const accountId = user?.id;
  const identity = useMemo(
    () =>
      accountId != null && release != null
        ? { userId: accountId, campaignId: release.campaignId }
        : null,
    [accountId, release],
  );
  const canAutoOpen =
    isAuthenticated &&
    !isWeatherIntroductionPending &&
    identity != null &&
    WhatsNewPolicy.canAutoOpen({
      config,
      user,
      appVersion,
      hasSeen: repository.isSeen(identity),
    });

  useEffect(() => {
    if (!canAutoOpen || !isStable || identity == null || release == null) {
      return;
    }

    const task = requestIdleCallback(() => {
      if (repository.claimSeen(identity, toInstant(new Date().toISOString()))) {
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'auto' } });
        refreshState();
      }
    });

    return () => cancelIdleCallback(task);
  }, [canAutoOpen, identity, isStable, push, release, repository]);

  const isReentryVisible =
    identity != null &&
    WhatsNewPolicy.isReentryVisible(repository.getReentryOpenedAt(identity), now);

  const openFromReentry = () => {
    if (release != null) {
      push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'feed_reentry' } });
    }
  };

  const dismissReentry = () => {
    if (identity != null) {
      repository.dismissReentry(identity);
      refreshState();
    }
  };

  return { isReentryVisible, openFromReentry, dismissReentry };
}
