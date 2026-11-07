import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStoredString } from '@src/shared/infra/storage/mmkv-storage';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { getNativeAppVersion } from '../apis/native-app-version';
import {
  parseReentryOpenedAt,
  whatsNewReentryKey,
  whatsNewSeenKey,
} from '../apis/whats-new.repository';
import { RELEASES } from '../constants/releases';
import { WhatsNewPolicy } from '../domains/whats-new.model';

interface WhatsNewFeedInput {
  isStable: boolean;
  /** 날씨 위치 안내가 뜰 수 있는 동안에는 자동으로 열지 않아 두 안내가 겹치지 않게 한다 */
  isWeatherIntroductionPending: boolean;
  isInviteAvailable: boolean;
}

/** 서버가 켠 캠페인을 처음 한 번 자동으로 열고, 14일 동안 피드 카드로 다시 열게 한다 */
export function useWhatsNewFeed({
  isStable,
  isWeatherIntroductionPending,
  isInviteAvailable,
}: WhatsNewFeedInput) {
  const status = useAuthStatus();
  const isAuthenticated = status === 'authenticated';
  const { data: config } = useQuery({
    ...useGetFeatureCampaignConfigQueryOptions(),
    enabled: isAuthenticated,
  });
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const appVersion = useMemo(getNativeAppVersion, []);
  const repository = useWhatsNewRepository();
  const now = useMinuteNow();
  const push = useSingleTap(router.push);

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
  const storedIdentity = identity ?? { userId: '', campaignId: '' };
  const [seenAt] = useStoredString(whatsNewSeenKey(storedIdentity));
  const [reentryOpenedAt] = useStoredString(whatsNewReentryKey(storedIdentity));
  const canAutoOpen =
    isAuthenticated &&
    !isWeatherIntroductionPending &&
    identity != null &&
    WhatsNewPolicy.canAutoOpen({
      config,
      user,
      appVersion,
      hasSeen: seenAt != null,
    });

  useEffect(() => {
    if (!canAutoOpen || !isStable || identity == null || release == null) {
      return;
    }

    const task = requestIdleCallback(() => {
      if (repository.claimSeen(identity, getNowInstant())) {
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'auto' } });
      }
    });

    return () => cancelIdleCallback(task);
  }, [canAutoOpen, identity, isStable, push, release, repository]);

  const isReentryVisible =
    identity != null && WhatsNewPolicy.isReentryVisible(parseReentryOpenedAt(reentryOpenedAt), now);

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
