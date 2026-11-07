import {
  useApplicationMetadata,
  useSyncStorage,
  useWhatsNewRepository,
} from '@src/bootstrap/providers/di-context';
import { useGetFeatureCampaignConfigQueryOptions } from '@src/features/app-config/feature-campaign/queries/feature-campaign.queries';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';

import {
  parseReentryOpenedAt,
  createWhatsNewReentryKey,
  createWhatsNewSeenKey,
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
  const storedIdentity = identity ?? { userId: '', campaignId: '' };
  const syncStorage = useSyncStorage();
  const [seenAt] = useSyncStorageString(syncStorage, createWhatsNewSeenKey(storedIdentity));
  const [reentryOpenedAt] = useSyncStorageString(
    syncStorage,
    createWhatsNewReentryKey(storedIdentity),
  );
  const shouldAutoOpen =
    isAuthenticated &&
    !isWeatherIntroductionPending &&
    identity != null &&
    WhatsNewPolicy.shouldAutoOpen({
      config,
      user,
      appVersion,
      hasSeen: seenAt != null,
    });

  useEffect(() => {
    if (!shouldAutoOpen || !isStable || identity == null || release == null) {
      return;
    }

    const task = requestIdleCallback(() => {
      if (repository.claimSeen(identity, getNowInstant())) {
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'auto' } });
      }
    });

    return () => cancelIdleCallback(task);
  }, [shouldAutoOpen, identity, isStable, push, release, repository]);

  const isReentryVisible =
    identity != null &&
    WhatsNewPolicy.shouldShowReentry(parseReentryOpenedAt(reentryOpenedAt), now);

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
