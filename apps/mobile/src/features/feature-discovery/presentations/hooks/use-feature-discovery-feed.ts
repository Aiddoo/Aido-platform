import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useFeatureDiscoveryStateService } from '@src/bootstrap/providers/di-context';
import { FeatureDiscoveryPolicy } from '@src/features/feature-discovery/models/feature-discovery.model';
import { getBundledFeatureDiscoveryCampaign } from '@src/features/feature-discovery/models/feature-discovery.registry';
import { getNativeAppVersion } from '@src/features/feature-discovery/services/native-app-version';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useWeatherSession } from '@src/features/weather/presentations/providers/weather-session-provider';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { useFeatureDiscoveryQueryOptions } from '../queries/get-feature-discovery-query-options';
import { claimAndOpenFeatureDiscovery } from '../state/feature-discovery-auto-open';
import { useFeatureDiscoveryHub } from './use-feature-discovery-hub';

export function useFeatureDiscoveryFeed() {
  const weather = useWeatherSession();
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const configOptions = useFeatureDiscoveryQueryOptions();
  const userOptions = useGetMeQueryOptions();
  const { data: config } = useQuery({ ...configOptions, enabled: isAuthenticated });
  const { data: user } = useQuery({ ...userOptions, enabled: isAuthenticated });
  const appVersion = useMemo(getNativeAppVersion, []);
  const isStable = useStableFeedForeground();
  const { openHub } = useFeatureDiscoveryHub();
  const stateService = useFeatureDiscoveryStateService();
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
  const hasSeen = identity ? stateService.isSeen(identity) : true;
  const canAutoOpen = FeatureDiscoveryPolicy.canAutoOpen({
    authStatus: weather.needsIntroduction ? 'loading' : status,
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

    const task = requestIdleCallback(() => {
      const opened = claimAndOpenFeatureDiscovery({
        canAutoOpen,
        isStable,
        claim: () => stateService.claimSeen(identity),
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

    return () => cancelIdleCallback(task);
  }, [accountId, campaign, canAutoOpen, identity, isStable, openHub, stateService]);

  const isReentryVisible =
    config?.enabled === true &&
    identity !== null &&
    campaign !== null &&
    stateService.isReentryVisible(identity);

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
