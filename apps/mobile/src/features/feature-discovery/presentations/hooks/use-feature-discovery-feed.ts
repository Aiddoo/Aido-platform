import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { FeatureDiscoveryPolicy } from '@src/features/feature-discovery/models/feature-discovery.model';
import { getBundledFeatureDiscoveryCampaign } from '@src/features/feature-discovery/models/feature-discovery.registry';
import { getNativeAppVersion } from '@src/features/feature-discovery/services/native-app-version';
import {
  claimFeatureDiscoverySeen,
  isFeatureDiscoveryReentryVisible,
  isFeatureDiscoverySeen,
} from '@src/features/feature-discovery/state/feature-discovery-state';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { InteractionManager } from 'react-native';
import { useFeatureDiscoveryQueryOptions } from '../queries/use-feature-discovery-query-options';
import { claimAndOpenFeatureDiscovery } from '../state/feature-discovery-auto-open';
import { useFeatureDiscoveryHub } from './use-feature-discovery-hub';
import { useStableFeedForeground } from './use-stable-feed-foreground';

export function useFeatureDiscoveryFeed() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const configOptions = useFeatureDiscoveryQueryOptions();
  const userOptions = useGetMeQueryOptions();
  const { data: config } = useQuery({ ...configOptions, enabled: isAuthenticated });
  const { data: user } = useQuery({ ...userOptions, enabled: isAuthenticated });
  const appVersion = useMemo(getNativeAppVersion, []);
  const isStable = useStableFeedForeground();
  const { openHub } = useFeatureDiscoveryHub();
  const [, refreshState] = useReducer((value: number) => value + 1, 0);

  const campaign =
    config?.enabled === true ? getBundledFeatureDiscoveryCampaign(config.campaignId) : null;
  const accountId = user?.id;
  const identity = useMemo(
    () =>
      accountId && campaign
        ? {
            userId: accountId,
            campaignId: campaign.id,
          }
        : null,
    [accountId, campaign],
  );
  const hasSeen = identity ? isFeatureDiscoverySeen(mmkvSyncStorage, identity) : true;
  const canAutoOpen = FeatureDiscoveryPolicy.canAutoOpen({
    authStatus: status,
    config,
    user,
    appVersion,
    hasBundledCampaign: campaign !== null,
    hasSeen,
  });

  useEffect(() => {
    if (!identity || !campaign || !accountId) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      const opened = claimAndOpenFeatureDiscovery({
        canAutoOpen,
        isStable,
        claim: () =>
          claimFeatureDiscoverySeen(mmkvSyncStorage, {
            ...identity,
            at: new Date(),
          }),
        open: () =>
          openHub({
            accountId,
            campaign,
            source: 'auto',
          }),
      });
      if (opened) {
        refreshState();
      }
    });

    return () => task.cancel();
  }, [accountId, campaign, canAutoOpen, identity, isStable, openHub]);

  const isReentryVisible =
    config?.enabled === true &&
    identity !== null &&
    campaign !== null &&
    isFeatureDiscoveryReentryVisible(mmkvSyncStorage, {
      ...identity,
      now: new Date(),
    });

  const openFromReentry = useCallback(() => {
    if (!accountId || !campaign) {
      return;
    }
    openHub({
      accountId,
      campaign,
      source: 'feed_reentry',
    });
  }, [accountId, campaign, openHub]);

  return {
    isReentryVisible,
    openFromReentry,
  };
}
